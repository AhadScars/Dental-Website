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

function load_app_config() {
  $path = __DIR__ . DIRECTORY_SEPARATOR . "config.php";
  if (!is_file($path)) return null;
  $cfg = include $path;
  if (!is_array($cfg)) return null;
  foreach (array("db_host", "db_name", "db_user", "db_pass", "db_charset", "dashboard_key", "db_port") as $key) {
    if (!isset($cfg[$key]) || !is_string($cfg[$key])) continue;
    $cfg[$key] = trim(preg_replace('/^\xEF\xBB\xBF/', "", $cfg[$key]));
  }
  return $cfg;
}

function is_db_ready($cfg) {
  if (!$cfg) return false;
  $name = isset($cfg["db_name"]) ? trim((string) $cfg["db_name"]) : "";
  $user = isset($cfg["db_user"]) ? trim((string) $cfg["db_user"]) : "";
  return $name !== "" && $user !== "";
}

function dashboard_key_ready($cfg) {
  $key = isset($cfg["dashboard_key"]) ? trim((string) $cfg["dashboard_key"]) : "";
  if ($key === "") return false;
  if (stripos($key, "change-this") !== false) return false;
  return strlen($key) >= 12;
}

function looks_like_hostinger_name($value) {
  return (bool) preg_match("/^u\\d+_/i", (string) $value);
}

function connect_error_payload($cfg, $e) {
  $host = trim((string) (isset($cfg["db_host"]) ? $cfg["db_host"] : "localhost"));
  $name = trim((string) (isset($cfg["db_name"]) ? $cfg["db_name"] : ""));
  $user = trim((string) (isset($cfg["db_user"]) ? $cfg["db_user"] : ""));
  $detail = $e ? $e->getMessage() : "";
  $detail = preg_replace("/using password: (YES|NO)/i", "using password: ***", $detail);

  $hint = "Open hPanel → Databases → MySQL Databases and copy the full database name and username. Then click Add User To Database and give All Privileges.";
  if ($name !== "" && !looks_like_hostinger_name($name)) {
    $hint = "db_name is currently \"$name\". On Hostinger it is usually longer, like u123456789_$name. Copy the exact name from hPanel, do not type a short name.";
  } else if ($user !== "" && !looks_like_hostinger_name($user)) {
    $hint = "db_user is currently \"$user\". On Hostinger it is usually longer, like u123456789_$user. Copy the exact username from hPanel, then add that user to the database.";
  } else if (stripos($detail, "Access denied") !== false) {
    $hint = "MySQL rejected this username/password. Use the database user password from hPanel, not your Hostinger login password. Confirm the user is added to the database.";
  } else if (stripos($detail, "Unknown database") !== false) {
    $hint = "That database name does not exist. Copy the full name from hPanel → MySQL Databases.";
  }

  return array(
    "ok" => false,
    "configured" => true,
    "connected" => false,
    "error" => "Could not log in to MySQL as $user on $host / $name. $hint",
    "detail" => $detail,
    "db_host" => $host,
    "db_name" => $name,
    "db_user" => $user,
  );
}

function pdo_connect($cfg) {
  if (!class_exists("PDO") || !in_array("mysql", PDO::getAvailableDrivers(), true)) {
    throw new Exception("PHP PDO MySQL is not enabled on this host.");
  }
  $host = trim((string) (isset($cfg["db_host"]) ? $cfg["db_host"] : "localhost"));
  if ($host === "") $host = "localhost";
  $name = trim((string) (isset($cfg["db_name"]) ? $cfg["db_name"] : ""));
  $user = trim((string) (isset($cfg["db_user"]) ? $cfg["db_user"] : ""));
  $pass = isset($cfg["db_pass"]) ? (string) $cfg["db_pass"] : "";
  $charset = trim((string) (isset($cfg["db_charset"]) ? $cfg["db_charset"] : "utf8mb4"));
  if ($charset === "") $charset = "utf8mb4";
  $port = isset($cfg["db_port"]) ? trim((string) $cfg["db_port"]) : "";
  if ($name === "" || $user === "") {
    throw new Exception("db_name and db_user are empty in config.php.");
  }
  $dsn = "mysql:host=" . $host . ";dbname=" . $name . ";charset=" . $charset;
  if ($port !== "") {
    $dsn = "mysql:host=" . $host . ";port=" . $port . ";dbname=" . $name . ";charset=" . $charset;
  }
  return new PDO($dsn, $user, $pass, array(
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ));
}

function db_connect($cfg) {
  if (!is_db_ready($cfg)) {
    json_out(500, array(
      "ok" => false,
      "error" => "Fill db_name and db_user in config.php. Copy config.example.php if needed.",
    ));
  }
  try {
    return pdo_connect($cfg);
  } catch (Exception $e) {
    json_out(500, connect_error_payload($cfg, $e));
  }
}

function require_dashboard_key($cfg, $data) {
  $expected = isset($cfg["dashboard_key"]) ? trim((string) $cfg["dashboard_key"]) : "";
  $got = isset($data["dashboardKey"]) ? trim((string) $data["dashboardKey"]) : "";
  if (!dashboard_key_ready($cfg)) {
    json_out(500, array(
      "ok" => false,
      "error" => "Dashboard is not configured.",
    ));
  }
  if ($got === "" || !hash_equals($expected, $got)) {
    json_out(403, array(
      "ok" => false,
      "error" => "Dashboard key does not match.",
    ));
  }
}

function normalize_phone($phone) {
  $digits = preg_replace("/\D+/", "", (string) $phone);
  if (strlen($digits) > 10) $digits = substr($digits, -10);
  return $digits;
}

function normalize_time($time) {
  return strtoupper(trim(preg_replace("/\s+/", " ", (string) $time)));
}

function normalize_status($status) {
  $status = strtolower(trim((string) $status));
  $allowed = array("pending", "confirmed", "completed", "cancelled", "rejected", "noshow");
  return in_array($status, $allowed, true) ? $status : "pending";
}

function is_closed_status($status) {
  return $status === "cancelled" || $status === "rejected" || $status === "noshow";
}

function to_mysql_dt($value) {
  if (!$value) return date("Y-m-d H:i:s");
  $ts = strtotime((string) $value);
  if ($ts === false) return date("Y-m-d H:i:s");
  return date("Y-m-d H:i:s", $ts);
}

function from_mysql_dt($value) {
  if (!$value) return "";
  $ts = strtotime((string) $value);
  if ($ts === false) return (string) $value;
  return date("c", $ts);
}

function read_json_body() {
  $raw = file_get_contents("php://input");
  if (!$raw) return array();
  $data = json_decode($raw, true);
  return is_array($data) ? $data : array();
}

function row_to_appointment($row) {
  return array(
    "id" => $row["id"],
    "patientName" => $row["patient_name"],
    "phone" => $row["phone"],
    "email" => $row["email"],
    "message" => isset($row["message"]) ? $row["message"] : "",
    "treatmentId" => $row["treatment_id"],
    "treatmentName" => $row["treatment_name"],
    "date" => $row["appt_date"],
    "time" => $row["appt_time"],
    "doctor" => $row["doctor"],
    "status" => $row["status"],
    "createdAt" => from_mysql_dt($row["created_at"]),
    "updatedAt" => from_mysql_dt($row["updated_at"]),
    "fromServer" => true,
  );
}

function read_appointment_payload($src) {
  if (!is_array($src)) $src = array();
  $id = trim((string) (isset($src["id"]) ? $src["id"] : ""));
  if ($id === "") $id = "CDC-" . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
  $date = trim((string) (isset($src["date"]) ? $src["date"] : ""));
  $email = trim((string) (isset($src["email"]) ? $src["email"] : ""));
  $phone = trim((string) (isset($src["phone"]) ? $src["phone"] : ""));
  return array(
    "id" => substr($id, 0, 32),
    "patientName" => trim((string) (isset($src["patientName"]) ? $src["patientName"] : "")),
    "phone" => $phone,
    "phoneKey" => normalize_phone($phone),
    "email" => $email,
    "message" => trim((string) (isset($src["message"]) ? $src["message"] : "")),
    "treatmentId" => trim((string) (isset($src["treatmentId"]) ? $src["treatmentId"] : "")),
    "treatmentName" => trim((string) (isset($src["treatmentName"]) ? $src["treatmentName"] : "Consultation")),
    "date" => $date,
    "time" => normalize_time(isset($src["time"]) ? $src["time"] : ""),
    "doctor" => trim((string) (isset($src["doctor"]) ? $src["doctor"] : "")),
    "status" => normalize_status(isset($src["status"]) ? $src["status"] : "pending"),
    "createdAt" => to_mysql_dt(isset($src["createdAt"]) ? $src["createdAt"] : ""),
    "updatedAt" => to_mysql_dt(isset($src["updatedAt"]) ? $src["updatedAt"] : ""),
  );
}

function validate_appointment($appt, $creating) {
  if ($creating && $appt["patientName"] === "") return "Patient name is required.";
  if ($creating && $appt["phoneKey"] === "") return "Phone number is required.";
  if ($creating && ($appt["email"] === "" || strpos($appt["email"], "@") === false)) return "Email is required.";
  if ($creating && !preg_match("/^\d{4}-\d{2}-\d{2}$/", $appt["date"])) return "Please select a date.";
  if ($creating && $appt["time"] === "") return "Please select a time slot.";
  return "";
}

function table_missing(Exception $e) {
  $msg = $e->getMessage();
  return stripos($msg, "appointments") !== false && (stripos($msg, "doesn't exist") !== false || stripos($msg, "Base table") !== false);
}

function slot_taken(PDO $pdo, $date, $time, $ignoreId) {
  $sql = "SELECT id FROM appointments WHERE appt_date = ? AND appt_time = ? AND status NOT IN ('cancelled','rejected','noshow')";
  $params = array($date, $time);
  if ($ignoreId) {
    $sql .= " AND id <> ?";
    $params[] = $ignoreId;
  }
  $sql .= " LIMIT 1";
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  return (bool) $stmt->fetch();
}

function booking_guard(PDO $pdo, $phoneKey) {
  if ($phoneKey === "") {
    return array("ok" => false, "error" => "Enter a valid 10-digit phone number.");
  }
  $stmt = $pdo->prepare(
    "SELECT status FROM appointments WHERE phone_key = ? AND status IN ('pending','confirmed')"
  );
  $stmt->execute(array($phoneKey));
  $rows = $stmt->fetchAll();
  $pending = 0;
  $open = 0;
  foreach ($rows as $row) {
    $open += 1;
    if ($row["status"] === "pending") $pending += 1;
  }
  if ($pending >= 1) {
    return array(
      "ok" => false,
      "error" => "This number already has a pending request. Wait for the clinic to confirm or call 072340 01111.",
    );
  }
  if ($open >= 2) {
    return array(
      "ok" => false,
      "error" => "This number already has two open appointments. Please attend or cancel one first.",
    );
  }
  return array("ok" => true, "pending" => $pending, "open" => $open);
}

function fetch_by_id(PDO $pdo, $id) {
  $stmt = $pdo->prepare("SELECT * FROM appointments WHERE id = ? LIMIT 1");
  $stmt->execute(array($id));
  $row = $stmt->fetch();
  return $row ? row_to_appointment($row) : null;
}

function upsert_appointment(PDO $pdo, $appt) {
  $stmt = $pdo->prepare(
    "INSERT INTO appointments (
      id, patient_name, phone, phone_key, email, message, treatment_id, treatment_name,
      appt_date, appt_time, doctor, status, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      patient_name = VALUES(patient_name),
      phone = VALUES(phone),
      phone_key = VALUES(phone_key),
      email = VALUES(email),
      message = VALUES(message),
      treatment_id = VALUES(treatment_id),
      treatment_name = VALUES(treatment_name),
      appt_date = VALUES(appt_date),
      appt_time = VALUES(appt_time),
      doctor = VALUES(doctor),
      status = VALUES(status),
      updated_at = VALUES(updated_at)"
  );
  $stmt->execute(array(
    $appt["id"],
    $appt["patientName"],
    $appt["phone"],
    $appt["phoneKey"],
    $appt["email"],
    $appt["message"],
    $appt["treatmentId"],
    $appt["treatmentName"] ? $appt["treatmentName"] : "Consultation",
    $appt["date"],
    $appt["time"],
    $appt["doctor"],
    $appt["status"],
    $appt["createdAt"],
    $appt["updatedAt"],
  ));
  return fetch_by_id($pdo, $appt["id"]);
}

$cfg = load_app_config();

if ($_SERVER["REQUEST_METHOD"] === "GET") {
  $payload = array(
    "ok" => true,
    "service" => "elegancia-appointments",
    "configured" => is_db_ready($cfg),
    "keyReady" => dashboard_key_ready($cfg),
    "connected" => false,
  );
  if (is_db_ready($cfg)) {
    try {
      pdo_connect($cfg);
      $payload["connected"] = true;
    } catch (Exception $e) {
      $fail = connect_error_payload($cfg, $e);
      $payload["ok"] = false;
      $payload["error"] = $fail["error"];
      $payload["detail"] = $fail["detail"];
      $payload["db_name"] = $fail["db_name"];
      $payload["db_user"] = $fail["db_user"];
    }
  }
  json_out(200, $payload);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  json_out(405, array("ok" => false, "error" => "Use POST."));
}

$data = read_json_body();
$route = isset($data["route"]) ? strtolower(trim((string) $data["route"])) : "";

if (!is_db_ready($cfg)) {
  json_out(503, array(
    "ok" => false,
    "configured" => false,
    "error" => "MySQL is not set up yet. Copy config.example.php to config.php, fill the Hostinger database details, and import install.sql.",
  ));
}

try {
  $pdo = db_connect($cfg);

  if ($route === "create") {
    $appt = read_appointment_payload(isset($data["appointment"]) ? $data["appointment"] : $data);
    $err = validate_appointment($appt, true);
    if ($err) json_out(400, array("ok" => false, "error" => $err));
    $existing = fetch_by_id($pdo, $appt["id"]);
    if (!$existing) {
      $guard = booking_guard($pdo, $appt["phoneKey"]);
      if (!$guard["ok"]) json_out(409, $guard);
    }
    if (slot_taken($pdo, $appt["date"], $appt["time"], $appt["id"])) {
      json_out(409, array("ok" => false, "error" => "That date and time is already booked. Please choose another slot."));
    }
    $saved = upsert_appointment($pdo, $appt);
    json_out(200, array("ok" => true, "appointment" => $saved));
  }

  if ($route === "taken") {
    $date = trim((string) (isset($data["date"]) ? $data["date"] : ""));
    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
      json_out(400, array("ok" => false, "error" => "A valid date is required."));
    }
    $stmt = $pdo->prepare(
      "SELECT id, appt_time, status FROM appointments WHERE appt_date = ? AND status NOT IN ('cancelled','rejected','noshow')"
    );
    $stmt->execute(array($date));
    $times = array();
    foreach ($stmt->fetchAll() as $row) {
      $times[] = array(
        "id" => $row["id"],
        "time" => $row["appt_time"],
        "status" => $row["status"],
      );
    }
    json_out(200, array("ok" => true, "date" => $date, "times" => $times));
  }

  if ($route === "guard") {
    $phoneKey = normalize_phone(isset($data["phone"]) ? $data["phone"] : "");
    json_out(200, booking_guard($pdo, $phoneKey));
  }

  if ($route === "list") {
    require_dashboard_key($cfg, $data);
    $rows = $pdo->query("SELECT * FROM appointments ORDER BY appt_date DESC, appt_time ASC")->fetchAll();
    $list = array();
    foreach ($rows as $row) $list[] = row_to_appointment($row);
    json_out(200, array("ok" => true, "appointments" => $list));
  }

  if ($route === "update") {
    require_dashboard_key($cfg, $data);
    $src = isset($data["appointment"]) ? $data["appointment"] : $data;
    $id = trim((string) (isset($src["id"]) ? $src["id"] : (isset($data["id"]) ? $data["id"] : "")));
    $current = $id ? fetch_by_id($pdo, $id) : null;
    if (!$current) json_out(404, array("ok" => false, "error" => "Appointment not found."));
    $merged = array_merge($current, is_array($src) ? $src : array());
    $appt = read_appointment_payload($merged);
    $appt["id"] = $current["id"];
    $appt["createdAt"] = to_mysql_dt($current["createdAt"]);
    $appt["updatedAt"] = to_mysql_dt("");
    $err = validate_appointment($appt, true);
    if ($err) json_out(400, array("ok" => false, "error" => $err));
    if (!is_closed_status($appt["status"]) && slot_taken($pdo, $appt["date"], $appt["time"], $appt["id"])) {
      json_out(409, array("ok" => false, "error" => "That date and time is already booked."));
    }
    $saved = upsert_appointment($pdo, $appt);
    json_out(200, array("ok" => true, "appointment" => $saved));
  }

  if ($route === "delete") {
    require_dashboard_key($cfg, $data);
    $id = trim((string) (isset($data["id"]) ? $data["id"] : ""));
    if ($id === "") json_out(400, array("ok" => false, "error" => "Appointment id is required."));
    $stmt = $pdo->prepare("DELETE FROM appointments WHERE id = ?");
    $stmt->execute(array($id));
    json_out(200, array("ok" => true));
  }

  json_out(400, array("ok" => false, "error" => "Unknown appointments route."));
} catch (Exception $e) {
  if (table_missing($e)) {
    json_out(500, array(
      "ok" => false,
      "error" => "The appointments table is missing. In phpMyAdmin, import install.sql into your database.",
    ));
  }
  json_out(500, array("ok" => false, "error" => "Database error. Check config.php and install.sql."));
}
