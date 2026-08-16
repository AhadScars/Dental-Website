const {
  applyCors,
  readBody,
  jsonError,
  status,
  sendAppointmentEmail,
  sendPatientStatusEmail,
  sendOtpEmail,
  issueOtpChallenge,
  verifyOtpChallenge,
  loadFileConfig,
  saveFileConfig,
} = require("../lib/mail");

function makeCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function pathName(req) {
  const url = String(req.url || "");
  return url.split("?")[0].replace(/\/+$/, "") || "/";
}

async function handleOtp(data, res) {
  const action = data.action || "send";
  const email = String(data.email || "").trim();
  const phone = String(data.phone || "").trim();

  if (action === "verify") {
    const result = verifyOtpChallenge(data.challenge, data.code, email, phone);
    if (!result.ok) return res.status(400).json(result);
    return res.status(200).json({ ok: true, verified: true });
  }

  if (!email || email.indexOf("@") === -1) {
    return res.status(400).json({ ok: false, error: "Enter a valid email address." });
  }
  if (String(phone).replace(/\D/g, "").length < 10) {
    return res.status(400).json({ ok: false, error: "Enter a valid phone number." });
  }

  const code = makeCode();
  await sendOtpEmail({
    to: email,
    email,
    code,
    patientName: data.patientName,
    treatmentName: data.treatmentName,
    date: data.date,
    time: data.time,
    smtpUser: data.smtpUser,
    smtpPass: data.smtpPass,
  });

  return res.status(200).json({
    ok: true,
    challenge: issueOtpChallenge(email, phone, code),
    expiresIn: 600,
  });
}

async function handleNotify(data, res) {
  const action = String(data.action || "").toLowerCase();
  const patientTo = String(data.to || data.patientEmail || "").trim();
  const isPatientStatus =
    data.kind === "patient-status" ||
    data.route === "patient" ||
    action === "confirmed" ||
    action === "rejected" ||
    action === "rescheduled" ||
    Boolean(patientTo && data.kind === "patient-status");

  if (isPatientStatus || data.route === "patient") {
    data.kind = "patient-status";
    data.to = patientTo || data.email;
    const result = await sendPatientStatusEmail(data);
    return res.status(200).json({
      ok: true,
      to: (result && result.to) || data.to,
      kind: "patient-status",
    });
  }

  await sendAppointmentEmail(data);
  return res.status(200).json({ ok: true, kind: "clinic" });
}

async function handleSmtpConfig(data, res) {
  const email = String(data.email || "").trim();
  const password = String(data.appPassword || "").replace(/\s+/g, "");
  if (!email || email.indexOf("@") === -1) {
    return res.status(400).json({ ok: false, error: "Enter the clinic Gmail address." });
  }
  const current = loadFileConfig();
  const envPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (!password && !current.appPassword && !envPass) {
    return res.status(400).json({ ok: false, error: "Enter the Gmail App Password." });
  }
  try {
    const saved = saveFileConfig(email, password);
    return res.status(200).json({
      ok: true,
      email: saved.email,
      configured: Boolean(saved.email && saved.appPassword),
    });
  } catch (err) {
    if (process.env.VERCEL) {
      const configured = Boolean(
        (process.env.GMAIL_USER || process.env.SMTP_USER) &&
          (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS)
      );
      return res.status(configured ? 200 : 400).json({
        ok: configured,
        vercel: true,
        email,
        configured,
        error: configured
          ? undefined
          : "On Vercel, add GMAIL_USER and GMAIL_APP_PASSWORD in Project → Settings → Environment Variables, then redeploy.",
      });
    }
    throw err;
  }
}

module.exports = async function handler(req, res) {
  try {
    applyCors(res);
    if (req.method === "OPTIONS") return res.status(204).end();

    const pathname = pathName(req);
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        service: "elegancia-mail",
        path: pathname,
        vercel: Boolean(process.env.VERCEL),
        hasGmailUser: Boolean(process.env.GMAIL_USER || process.env.SMTP_USER),
        hasGmailPass: Boolean(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST." });
    }

    const data = await readBody(req);
    const route = String(data.route || "").toLowerCase();

    if (route === "otp" || pathname.indexOf("booking-otp") !== -1) {
      return handleOtp(data, res);
    }
    if (route === "patient" || pathname.indexOf("notify-patient") !== -1) {
      data.kind = "patient-status";
      return handleNotify(data, res);
    }
    if (route === "notify" || pathname.indexOf("notify-appointment") !== -1) {
      return handleNotify(data, res);
    }
    if (route === "smtp-config" || pathname.indexOf("smtp-config") !== -1) {
      return handleSmtpConfig(data, res);
    }
    if (route === "status" || pathname.indexOf("smtp-status") !== -1) {
      return res.status(200).json(status());
    }

    if (data.action === "send" || data.action === "verify") return handleOtp(data, res);
    if (data.kind === "patient-status") return handleNotify(data, res);
    if (data.patientName && data.treatmentName) return handleNotify(data, res);

    return res.status(400).json({ ok: false, error: "Unknown mail route." });
  } catch (err) {
    return jsonError(res, err, "Mail function failed.");
  }
};
