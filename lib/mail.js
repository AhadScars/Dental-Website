const nodemailer = require("nodemailer");

function smtpUser(data) {
  return (
    (process.env.GMAIL_USER || process.env.SMTP_USER || "").trim() ||
    String((data && (data.smtpUser || data.adminEmail)) || "").trim()
  );
}

function smtpPass(data) {
  return (
    (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "") ||
    String((data && (data.smtpPass || data.appPassword)) || "").replace(/\s+/g, "")
  );
}

function isConfigured(data) {
  return Boolean(smtpUser(data) && smtpPass(data));
}

function status() {
  return {
    ok: true,
    running: true,
    vercel: Boolean(process.env.VERCEL),
    configured: isConfigured(),
    email: smtpUser(),
    host: "smtp.gmail.com",
    port: 465,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

async function sendAppointmentEmail(data) {
  data = data || {};
  if (!isConfigured(data)) {
    const err = new Error(
      "Gmail SMTP is not configured. Save the Gmail address and App Password in Admin → Settings, or set GMAIL_USER and GMAIL_APP_PASSWORD on Vercel."
    );
    err.status = 400;
    throw err;
  }

  const user = smtpUser(data);
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: smtpPass(data) },
  });

  const patient = data.patientName || "Patient";
  const subject =
    data.subject ||
    `New appointment · ${patient} · ${data.date || ""} ${data.time || ""}`.trim();

  await transporter.sendMail({
    from: `"Elegancia Dental" <${user}>`,
    to: user,
    replyTo: data.email || undefined,
    subject,
    html: buildHtml(data),
  });
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string") {
    return req.body ? JSON.parse(req.body) : {};
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

module.exports = {
  isConfigured,
  status,
  sendAppointmentEmail,
  applyCors,
  readBody,
};
