const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const CONFIG_PATH = path.join(__dirname, "..", "smtp-config.json");

function cleanUser(value) {
  return String(value || "").trim();
}

function cleanPass(value) {
  return String(value || "").replace(/[\s\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff"']+/g, "");
}

function loadFileConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return {
      email: cleanUser((data && data.email) || ""),
      appPassword: cleanPass((data && data.appPassword) || ""),
    };
  } catch (err) {
    return { email: "", appPassword: "" };
  }
}

function saveFileConfig(email, appPassword) {
  const current = loadFileConfig();
  const next = {
    email: cleanUser(email || current.email || ""),
    appPassword: cleanPass(appPassword || current.appPassword || ""),
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function smtpUser(data) {
  const fromReq = cleanUser((data && (data.smtpUser || data.adminEmail)) || "");
  const fromEnv = cleanUser(process.env.GMAIL_USER || process.env.SMTP_USER || "");
  const fromFile = loadFileConfig().email;
  return fromReq || fromEnv || fromFile;
}

function smtpPass(data) {
  const fromReq = cleanPass((data && (data.smtpPass || data.appPassword)) || "");
  const fromEnv = cleanPass(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "");
  const fromFile = loadFileConfig().appPassword;
  return fromReq || fromEnv || fromFile;
}

function gmailAuthError(err) {
  const msg = String((err && err.message) || err || "");
  if (/Invalid login|EAUTH|Username and Password not accepted|535-5\.7\.8|BadCredentials/i.test(msg)) {
    const wrapped = new Error(
      "Gmail rejected the login. Do not use your normal Gmail password. Turn on 2-Step Verification, then create a 16-character App Password at https://myaccount.google.com/apppasswords and save that in Admin → Settings."
    );
    wrapped.status = 401;
    return wrapped;
  }
  return err;
}

function isConfigured(data) {
  return Boolean(smtpUser(data) && smtpPass(data));
}

function status() {
  const file = loadFileConfig();
  const user = smtpUser();
  return {
    ok: true,
    running: true,
    vercel: Boolean(process.env.VERCEL),
    configured: Boolean(user && smtpPass()),
    email: user,
    host: "smtp.gmail.com",
    port: 465,
    source: (process.env.GMAIL_USER || process.env.SMTP_USER
      ? "env"
      : file.email
        ? "file"
        : ""),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function patientStatusCopy(action, data) {
  const patient = data.patientName || "there";
  const when = [data.date, data.time].filter(Boolean).join(" · ");
  const treatment = data.treatmentName || data.treatment || "your visit";
  if (action === "confirmed") {
    return {
      subject: `Your appointment is confirmed · ${when}`.trim(),
      heading: "Your appointment is confirmed",
      intro: `Hi ${patient}, Elegancia Dental has accepted your booking.`,
      footer: "Please arrive a few minutes early. Call 072340 01111 if you need to change it.",
    };
  }
  if (action === "rescheduled") {
    return {
      subject: `Your appointment was rescheduled · ${when}`.trim(),
      heading: "Your appointment was moved",
      intro: `Hi ${patient}, the clinic has rescheduled ${treatment} to a new time.`,
      footer: "Please use the new date and time below. Call 072340 01111 if this does not work.",
    };
  }
  return {
    subject: "Your appointment request was not accepted · Elegancia Dental",
    heading: "Your appointment was not accepted",
    intro: `Hi ${patient}, the clinic could not accept this booking.`,
    footer: "Call 072340 01111 or book another slot on the website.",
  };
}

function buildPatientStatusHtml(data) {
  const copy = patientStatusCopy(data.action, data);
  const rows = [
    ["Booking ID", data.id || data.booking_id],
    ["Treatment", data.treatmentName || data.treatment],
    ["Date", data.date],
    ["Time", data.time],
    ["Doctor", data.doctor],
    ["Status", data.status || data.action],
  ];
  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#66727a;width:140px">${escapeHtml(
          label
        )}</td><td style="padding:8px 0;border-bottom:1px solid #ebe7e1"><strong>${escapeHtml(
          value
        )}</strong></td></tr>`
    )
    .join("");
  return {
    subject: data.subject || copy.subject,
    html: `<div style="font-family:Georgia,serif;color:#12202c;max-width:560px">
      <h2 style="margin:0 0 8px">${escapeHtml(copy.heading)}</h2>
      <p style="margin:0 0 18px;color:#66727a">${escapeHtml(copy.intro)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">${table}</table>
      <p style="margin:22px 0 0;color:#66727a;font-size:13px">${escapeHtml(copy.footer)}</p>
    </div>`,
  };
}

function buildHtml(data) {
  const rows = [
    ["Booking ID", data.id || data.booking_id],
    ["Patient", data.patientName],
    ["Phone", data.phone || data.patient_phone],
    ["Email", data.email || data.patient_email],
    ["Treatment", data.treatmentName || data.treatment],
    ["Date", data.date],
    ["Time", data.time],
    ["Doctor", data.doctor],
    ["Status", data.status || "pending"],
    ["Message", data.message || "—"],
  ];
  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#66727a;width:140px">${escapeHtml(
          label
        )}</td><td style="padding:8px 0;border-bottom:1px solid #ebe7e1"><strong>${escapeHtml(
          value
        )}</strong></td></tr>`
    )
    .join("");
  return `<div style="font-family:Georgia,serif;color:#12202c;max-width:560px">
    <h2 style="margin:0 0 8px">New appointment request</h2>
    <p style="margin:0 0 18px;color:#66727a">Elegancia Dental, Implant &amp; Maxillofacial Centre</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">${table}</table>
    <p style="margin:22px 0 0;color:#66727a;font-size:13px">Open the Elegancia admin desk to confirm or reschedule this visit.</p>
  </div>`;
}

function createTransport(data) {
  const user = smtpUser(data);
  return {
    user,
    transporter: nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      auth: { user, pass: smtpPass(data) },
    }),
  };
}

function patientRecipient(data) {
  return cleanUser((data && (data.to || data.patientEmail)) || "");
}

function isPatientStatus(data) {
  const action = String((data && data.action) || "").toLowerCase();
  if ((data && data.kind) === "patient-status") return true;
  if (action === "confirmed" || action === "rejected" || action === "rescheduled") return true;
  const to = patientRecipient(data);
  const clinic = smtpUser(data);
  return Boolean(to && clinic && to.toLowerCase() !== clinic.toLowerCase());
}

async function sendAppointmentEmail(data) {
  data = data || {};
  if (!isConfigured(data)) {
    const err = new Error(
      "Gmail SMTP is not configured. Save the Gmail address and App Password in Admin → Settings, or set GMAIL_USER and GMAIL_APP_PASSWORD on Vercel."
    );
    err.status = 400;
    throw err;
  }

  if (isPatientStatus(data)) {
    return sendPatientStatusEmail(data);
  }

  const { user, transporter } = createTransport(data);
  const patient = data.patientName || "Patient";
  const subject =
    data.subject ||
    `New appointment · ${patient} · ${data.date || ""} ${data.time || ""}`.trim();

  try {
    await transporter.sendMail({
      from: `"Elegancia Dental" <${user}>`,
      to: user,
      replyTo: data.email || undefined,
      subject,
      html: buildHtml(data),
    });
  } catch (err) {
    throw gmailAuthError(err);
  }
}

async function sendPatientStatusEmail(data) {
  data = data || {};
  const recipient = patientRecipient(data);
  if (!recipient || recipient.indexOf("@") === -1) {
    const err = new Error("This booking has no patient email to notify.");
    err.status = 400;
    throw err;
  }
  const { user, transporter } = createTransport(data);
  const letter = buildPatientStatusHtml(data);
  try {
    await transporter.sendMail({
      from: `"Elegancia Dental" <${user}>`,
      to: recipient,
      bcc: undefined,
      replyTo: user,
      subject: letter.subject,
      html: letter.html,
    });
  } catch (err) {
    throw gmailAuthError(err);
  }
  return { to: recipient };
}

function otpSecret() {
  return (
    process.env.OTP_SECRET ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASS ||
    loadFileConfig().appPassword ||
    "elegancia-booking-otp"
  );
}

function b64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(value) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

function hashOtp(code) {
  return crypto.createHmac("sha256", otpSecret()).update(String(code)).digest("hex");
}

function issueOtpChallenge(email, phone, code) {
  const payload = {
    email: String(email || "").trim().toLowerCase(),
    phone: String(phone || "").replace(/\D/g, "").slice(-10),
    hash: hashOtp(code),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", otpSecret()).update(body).digest("hex");
  return body + "." + signature;
}

function verifyOtpChallenge(challenge, code, email, phone) {
  const parts = String(challenge || "").split(".");
  if (parts.length !== 2) return { ok: false, error: "The verification code expired. Request a new one." };
  const [body, signature] = parts;
  const expected = crypto.createHmac("sha256", otpSecret()).update(body).digest("hex");
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return { ok: false, error: "That code is not valid." };
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(body));
  } catch (err) {
    return { ok: false, error: "The verification code expired. Request a new one." };
  }
  if (!payload || Date.now() > Number(payload.exp || 0)) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }
  const wantEmail = String(email || "").trim().toLowerCase();
  const wantPhone = String(phone || "").replace(/\D/g, "").slice(-10);
  if (payload.email !== wantEmail || payload.phone !== wantPhone) {
    return { ok: false, error: "That code does not match this booking." };
  }
  if (payload.hash !== hashOtp(code)) {
    return { ok: false, error: "That code is not valid." };
  }
  return { ok: true };
}

async function sendOtpEmail(data) {
  data = data || {};
  if (!isConfigured(data)) {
    const err = new Error(
      "Gmail SMTP is not configured. Save the Gmail address and App Password in Admin → Settings first."
    );
    err.status = 400;
    throw err;
  }
  const user = smtpUser(data);
  const to = String(data.to || data.email || "").trim();
  if (!to) {
    const err = new Error("Patient email is required to send a verification code.");
    err.status = 400;
    throw err;
  }
  const { transporter } = createTransport(data);
  const code = String(data.code || "");
  const patient = data.patientName || "there";
  try {
    await transporter.sendMail({
      from: `"Elegancia Dental" <${user}>`,
      to,
      subject: "Your Elegancia Dental booking code: " + code,
      html: `<div style="font-family:Georgia,serif;color:#12202c;max-width:520px">
      <h2 style="margin:0 0 8px">Confirm your appointment</h2>
      <p style="margin:0 0 16px;color:#66727a">Hi ${escapeHtml(patient)}, use this code to finish your booking. It expires in 10 minutes.</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:0 0 18px">${escapeHtml(code)}</p>
      <p style="margin:0;color:#66727a;font-size:14px">${escapeHtml(data.treatmentName || "Appointment")} · ${escapeHtml(data.date || "")} · ${escapeHtml(data.time || "")}</p>
    </div>`,
    });
  } catch (err) {
    throw gmailAuthError(err);
  }
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function looksParsed(body) {
  return Boolean(
    body &&
      typeof body === "object" &&
      !Buffer.isBuffer(body) &&
      Object.keys(body).length > 0
  );
}

async function readBody(req) {
  if (looksParsed(req.body)) return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }
  if (Buffer.isBuffer(req.body) && req.body.length) {
    return JSON.parse(req.body.toString("utf8"));
  }
  const chunks = [];
  try {
    for await (const chunk of req) chunks.push(chunk);
  } catch (err) {
    if (looksParsed(req.body)) return req.body;
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return looksParsed(req.body) ? req.body : {};
  return JSON.parse(raw);
}

function jsonError(res, err, fallback) {
  let status = Number((err && err.status) || 500);
  if (!Number.isFinite(status) || status < 400 || status > 599) status = 500;
  const message = String((err && err.message) || fallback || "Mail function failed.");
  if (!res.headersSent) {
    res.status(status).json({ ok: false, error: message });
  }
}

module.exports = {
  isConfigured,
  status,
  sendAppointmentEmail,
  sendPatientStatusEmail,
  sendOtpEmail,
  issueOtpChallenge,
  verifyOtpChallenge,
  applyCors,
  readBody,
  jsonError,
  loadFileConfig,
  saveFileConfig,
};
