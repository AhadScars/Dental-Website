<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Cache-Control: no-store");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

function json_out($code, $payload) {
  http_response_code($code);
  header("Content-Type: application/json; charset=utf-8");
  echo json_encode($payload);
  exit;
}

function clean_user($value) {
  return trim((string) $value);
}

function clean_pass($value) {
  return preg_replace('/[\s\x{00A0}\x{2000}-\x{200B}\x{FEFF}"\']+/u', "", (string) $value);
}

function config_path() {
  return __DIR__ . DIRECTORY_SEPARATOR . "smtp-config.json";
}

function load_config() {
  $path = config_path();
  if (!is_file($path)) return array("email" => "", "appPassword" => "");
  $data = json_decode(@file_get_contents($path), true);
  if (!is_array($data)) return array("email" => "", "appPassword" => "");
  return array(
    "email" => clean_user(isset($data["email"]) ? $data["email"] : ""),
    "appPassword" => clean_pass(isset($data["appPassword"]) ? $data["appPassword"] : ""),
  );
}

function save_config($email, $password) {
  $current = load_config();
  $next = array(
    "email" => clean_user($email ? $email : $current["email"]),
    "appPassword" => clean_pass($password ? $password : $current["appPassword"]),
  );
  $ok = @file_put_contents(config_path(), json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
  if ($ok === false) {
    json_out(500, array("ok" => false, "error" => "Could not write smtp-config.json. Set file permissions to 644 and make the folder writable."));
  }
  return $next;
}

function smtp_user($data) {
  $fromReq = clean_user(isset($data["smtpUser"]) ? $data["smtpUser"] : (isset($data["adminEmail"]) ? $data["adminEmail"] : ""));
  $fromEnv = clean_user(getenv("GMAIL_USER") ? getenv("GMAIL_USER") : getenv("SMTP_USER"));
  $fromFile = load_config();
  return $fromReq ? $fromReq : ($fromEnv ? $fromEnv : $fromFile["email"]);
}

function smtp_pass($data) {
  $fromReq = clean_pass(isset($data["smtpPass"]) ? $data["smtpPass"] : (isset($data["appPassword"]) ? $data["appPassword"] : ""));
  $fromEnv = clean_pass(getenv("GMAIL_APP_PASSWORD") ? getenv("GMAIL_APP_PASSWORD") : getenv("SMTP_PASS"));
  $fromFile = load_config();
  return $fromReq ? $fromReq : ($fromEnv ? $fromEnv : $fromFile["appPassword"]);
}

function is_configured($data) {
  return smtp_user($data) && smtp_pass($data);
}

function h($value) {
  return htmlspecialchars((string) $value, ENT_QUOTES, "UTF-8");
}

function smtp_read($fp) {
  $out = "";
  while ($line = fgets($fp, 515)) {
    $out .= $line;
    if (isset($line[3]) && $line[3] === " ") break;
  }
  return $out;
}

function smtp_cmd($fp, $cmd, $ok) {
  if ($cmd !== null) fwrite($fp, $cmd . "\r\n");
  $reply = smtp_read($fp);
  $code = intval(substr($reply, 0, 3));
  $ok = is_array($ok) ? $ok : array($ok);
  if (!in_array($code, $ok, true)) {
    $msg = trim($reply);
    if ($code === 535 || stripos($msg, "Invalid login") !== false) {
      throw new Exception("Gmail rejected the login. Use a 16-character App Password from https://myaccount.google.com/apppasswords — not your normal Gmail password.");
    }
    throw new Exception($msg ? $msg : "Gmail SMTP command failed.");
  }
  return $reply;
}

function smtp_send($user, $pass, $from, $to, $subject, $html) {
  $fp = @stream_socket_client("ssl://smtp.gmail.com:465", $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
  if (!$fp) {
    throw new Exception("Could not connect to Gmail SMTP ($errstr). Ask Hostinger support to allow outbound port 465.");
  }
  stream_set_timeout($fp, 20);
  smtp_cmd($fp, null, 220);
  smtp_cmd($fp, "EHLO eleganciadental", 250);
  smtp_cmd($fp, "AUTH LOGIN", 334);
  smtp_cmd($fp, base64_encode($user), 334);
  smtp_cmd($fp, base64_encode($pass), 235);
  smtp_cmd($fp, "MAIL FROM:<$from>", 250);
  smtp_cmd($fp, "RCPT TO:<$to>", array(250, 251));
  smtp_cmd($fp, "DATA", 354);
  $headers = "From: Elegancia Dental <$from>\r\n";
  $headers .= "To: <$to>\r\n";
  $headers .= "Reply-To: <$from>\r\n";
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
  $headers .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
  fwrite($fp, $headers . "\r\n" . $html . "\r\n.\r\n");
  smtp_cmd($fp, null, 250);
  fwrite($fp, "QUIT\r\n");
  fclose($fp);
}

function clinic_html($data) {
  $rows = array(
    array("Booking ID", isset($data["id"]) ? $data["id"] : (isset($data["booking_id"]) ? $data["booking_id"] : "")),
    array("Patient", isset($data["patientName"]) ? $data["patientName"] : ""),
    array("Phone", isset($data["phone"]) ? $data["phone"] : ""),
    array("Email", isset($data["email"]) ? $data["email"] : ""),
    array("Treatment", isset($data["treatmentName"]) ? $data["treatmentName"] : ""),
    array("Date", isset($data["date"]) ? $data["date"] : ""),
    array("Time", isset($data["time"]) ? $data["time"] : ""),
    array("Doctor", isset($data["doctor"]) ? $data["doctor"] : ""),
    array("Status", isset($data["status"]) ? $data["status"] : "pending"),
    array("Message", isset($data["message"]) ? $data["message"] : "—"),
  );
  $table = "";
  foreach ($rows as $row) {
    $table .= "<tr><td style='padding:8px 12px 8px 0;color:#66727a;width:140px'>" . h($row[0]) . "</td><td style='padding:8px 0;border-bottom:1px solid #ebe7e1'><strong>" . h($row[1]) . "</strong></td></tr>";
  }
  return "<div style='font-family:Georgia,serif;color:#12202c;max-width:560px'><h2 style='margin:0 0 8px'>New appointment request</h2><p style='margin:0 0 18px;color:#66727a'>Elegancia Dental, Implant &amp; Maxillofacial Centre</p><table style='width:100%;border-collapse:collapse;font-size:15px'>$table</table></div>";
}

function patient_copy($action, $data) {
  $patient = isset($data["patientName"]) ? $data["patientName"] : "there";
  $when = trim((isset($data["date"]) ? $data["date"] : "") . " · " . (isset($data["time"]) ? $data["time"] : ""), " ·");
  $treatment = isset($data["treatmentName"]) ? $data["treatmentName"] : "your visit";
  if ($action === "confirmed") {
    return array("Your appointment is confirmed · $when", "Your appointment is confirmed", "Hi $patient, Elegancia Dental has accepted your booking.", "Please arrive a few minutes early. Call 072340 01111 if you need to change it.");
  }
  if ($action === "rescheduled") {
    return array("Your appointment was rescheduled · $when", "Your appointment was moved", "Hi $patient, the clinic has rescheduled $treatment to a new time.", "Please use the new date and time below. Call 072340 01111 if this does not work.");
  }
  return array("Your appointment request was not accepted · Elegancia Dental", "Your appointment was not accepted", "Hi $patient, the clinic could not accept this booking.", "Call 072340 01111 or book another slot on the website.");
}

function patient_html($data) {
  $copy = patient_copy(isset($data["action"]) ? $data["action"] : "", $data);
  $rows = array(
    array("Booking ID", isset($data["id"]) ? $data["id"] : ""),
    array("Treatment", isset($data["treatmentName"]) ? $data["treatmentName"] : ""),
    array("Date", isset($data["date"]) ? $data["date"] : ""),
    array("Time", isset($data["time"]) ? $data["time"] : ""),
    array("Doctor", isset($data["doctor"]) ? $data["doctor"] : ""),
    array("Status", isset($data["status"]) ? $data["status"] : (isset($data["action"]) ? $data["action"] : "")),
  );
  $table = "";
  foreach ($rows as $row) {
    $table .= "<tr><td style='padding:8px 12px 8px 0;color:#66727a;width:140px'>" . h($row[0]) . "</td><td style='padding:8px 0;border-bottom:1px solid #ebe7e1'><strong>" . h($row[1]) . "</strong></td></tr>";
  }
  return array($copy[0], "<div style='font-family:Georgia,serif;color:#12202c;max-width:560px'><h2 style='margin:0 0 8px'>" . h($copy[1]) . "</h2><p style='margin:0 0 18px;color:#66727a'>" . h($copy[2]) . "</p><table style='width:100%;border-collapse:collapse;font-size:15px'>$table</table><p style='margin:22px 0 0;color:#66727a;font-size:13px'>" . h($copy[3]) . "</p></div>");
}

function otp_secret() {
  $env = getenv("OTP_SECRET") ? getenv("OTP_SECRET") : (getenv("GMAIL_APP_PASSWORD") ? getenv("GMAIL_APP_PASSWORD") : "");
  if ($env) return $env;
  $cfg = load_config();
  return $cfg["appPassword"] ? $cfg["appPassword"] : "elegancia-booking-otp";
}

function b64url($value) {
  return rtrim(strtr(base64_encode($value), "+/", "-_"), "=");
}

function from_b64url($value) {
  $pad = strlen($value) % 4;
  if ($pad) $value .= str_repeat("=", 4 - $pad);
  return base64_decode(strtr($value, "-_", "+/"));
}

function issue_otp($email, $phone, $code) {
  $payload = json_encode(array(
    "email" => strtolower(trim($email)),
    "phone" => substr(preg_replace("/\D/", "", $phone), -10),
    "hash" => hash_hmac("sha256", $code, otp_secret()),
    "exp" => round(microtime(true) * 1000) + 10 * 60 * 1000,
  ));
  $body = b64url($payload);
  return $body . "." . hash_hmac("sha256", $body, otp_secret());
}

function verify_otp($challenge, $code, $email, $phone) {
  $parts = explode(".", (string) $challenge);
  if (count($parts) !== 2) return array("ok" => false, "error" => "The verification code expired. Request a new one.");
  $expected = hash_hmac("sha256", $parts[0], otp_secret());
  if (!hash_equals($expected, $parts[1])) return array("ok" => false, "error" => "That code is not valid.");
  $payload = json_decode(from_b64url($parts[0]), true);
  if (!$payload || round(microtime(true) * 1000) > intval($payload["exp"])) {
    return array("ok" => false, "error" => "That code has expired. Request a new one.");
  }
  $wantEmail = strtolower(trim($email));
  $wantPhone = substr(preg_replace("/\D/", "", $phone), -10);
  if ($payload["email"] !== $wantEmail || $payload["phone"] !== $wantPhone) {
    return array("ok" => false, "error" => "That code does not match this booking.");
  }
  if ($payload["hash"] !== hash_hmac("sha256", $code, otp_secret())) {
    return array("ok" => false, "error" => "That code is not valid.");
  }
  return array("ok" => true, "verified" => true);
}

function require_smtp($data) {
  if (!is_configured($data)) {
    json_out(400, array("ok" => false, "error" => "Gmail SMTP is not configured. Save the Gmail address and App Password in Admin → Settings."));
  }
}

$raw = file_get_contents("php://input");
$data = $raw ? json_decode($raw, true) : array();
if (!is_array($data)) $data = array();

if ($_SERVER["REQUEST_METHOD"] === "GET") {
  $cfg = load_config();
  json_out(200, array(
    "ok" => true,
    "service" => "elegancia-mail-php",
    "hosting" => "hostinger",
    "running" => true,
    "configured" => is_configured($data),
    "email" => $cfg["email"],
    "host" => "smtp.gmail.com",
    "port" => 465,
  ));
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  json_out(405, array("ok" => false, "error" => "Use POST."));
}

$route = strtolower(isset($data["route"]) ? $data["route"] : "");

try {
  if ($route === "status") {
    $cfg = load_config();
    json_out(200, array(
      "ok" => true,
      "running" => true,
      "configured" => is_configured($data),
      "email" => smtp_user($data) ? smtp_user($data) : $cfg["email"],
      "host" => "smtp.gmail.com",
      "port" => 465,
    ));
  }

  if ($route === "smtp-config") {
    $email = clean_user(isset($data["email"]) ? $data["email"] : "");
    $password = clean_pass(isset($data["appPassword"]) ? $data["appPassword"] : "");
    if (!$email || strpos($email, "@") === false) {
      json_out(400, array("ok" => false, "error" => "Enter the clinic Gmail address."));
    }
    $current = load_config();
    if (!$password && !$current["appPassword"]) {
      json_out(400, array("ok" => false, "error" => "Enter the Gmail App Password."));
    }
    $saved = save_config($email, $password);
    json_out(200, array("ok" => true, "email" => $saved["email"], "configured" => (bool) ($saved["email"] && $saved["appPassword"])));
  }

  if ($route === "otp") {
    $action = isset($data["action"]) ? $data["action"] : "send";
    $email = clean_user(isset($data["email"]) ? $data["email"] : "");
    $phone = isset($data["phone"]) ? $data["phone"] : "";
    if ($action === "verify") {
      $result = verify_otp(isset($data["challenge"]) ? $data["challenge"] : "", isset($data["code"]) ? $data["code"] : "", $email, $phone);
      json_out($result["ok"] ? 200 : 400, $result);
    }
    require_smtp($data);
    if (!$email || strpos($email, "@") === false) {
      json_out(400, array("ok" => false, "error" => "Enter a valid email address."));
    }
    if (strlen(preg_replace("/\D/", "", $phone)) < 10) {
      json_out(400, array("ok" => false, "error" => "Enter a valid phone number."));
    }
    $code = (string) mt_rand(100000, 999999);
    $user = smtp_user($data);
    $html = "<div style='font-family:Georgia,serif;color:#12202c;max-width:520px'><h2 style='margin:0 0 8px'>Confirm your appointment</h2><p style='margin:0 0 16px;color:#66727a'>Hi " . h(isset($data["patientName"]) ? $data["patientName"] : "there") . ", use this code to finish your booking. It expires in 10 minutes.</p><p style='font-size:32px;letter-spacing:8px;font-weight:700;margin:0 0 18px'>" . h($code) . "</p><p style='margin:0;color:#66727a;font-size:14px'>" . h(isset($data["treatmentName"]) ? $data["treatmentName"] : "Appointment") . " · " . h(isset($data["date"]) ? $data["date"] : "") . " · " . h(isset($data["time"]) ? $data["time"] : "") . "</p></div>";
    smtp_send($user, smtp_pass($data), $user, $email, "Your Elegancia Dental booking code: $code", $html);
    json_out(200, array("ok" => true, "challenge" => issue_otp($email, $phone, $code), "expiresIn" => 600));
  }

  if ($route === "patient" || (isset($data["kind"]) && $data["kind"] === "patient-status")) {
    require_smtp($data);
    $to = clean_user(isset($data["to"]) ? $data["to"] : (isset($data["patientEmail"]) ? $data["patientEmail"] : (isset($data["email"]) ? $data["email"] : "")));
    if (!$to || strpos($to, "@") === false) {
      json_out(400, array("ok" => false, "error" => "This booking has no patient email to notify."));
    }
    $user = smtp_user($data);
    $letter = patient_html($data);
    smtp_send($user, smtp_pass($data), $user, $to, $letter[0], $letter[1]);
    json_out(200, array("ok" => true, "to" => $to, "kind" => "patient-status"));
  }

  if ($route === "notify") {
    require_smtp($data);
    $user = smtp_user($data);
    $subject = isset($data["subject"]) ? $data["subject"] : ("New appointment · " . (isset($data["patientName"]) ? $data["patientName"] : "Patient"));
    smtp_send($user, smtp_pass($data), $user, $user, $subject, clinic_html($data));
    json_out(200, array("ok" => true, "kind" => "clinic"));
  }

  json_out(400, array("ok" => false, "error" => "Unknown mail route."));
} catch (Exception $err) {
  $msg = $err->getMessage();
  $code = (stripos($msg, "rejected the login") !== false) ? 401 : 500;
  json_out($code, array("ok" => false, "error" => $msg));
}
