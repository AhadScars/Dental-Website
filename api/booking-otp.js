const {
  applyCors,
  readBody,
  jsonError,
  sendOtpEmail,
  issueOtpChallenge,
  verifyOtpChallenge,
} = require("../lib/mail");

function makeCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

module.exports = async function handler(req, res) {
  try {
    applyCors(res);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, service: "booking-otp" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST." });
    }

    const data = await readBody(req);
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
  } catch (err) {
    return jsonError(res, err, "Could not send the verification code.");
  }
};
