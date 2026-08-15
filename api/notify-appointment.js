const { applyCors, readBody, sendAppointmentEmail } = require("../lib/mail");

async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST." });
  }

  try {
    const data = await readBody(req);
    await sendAppointmentEmail(data);
    return res.status(200).json({ ok: true });
  } catch (err) {
    const status = err.status || (String(err.message || "").includes("Invalid login") ? 401 : 500);
    return res.status(status).json({
      ok: false,
      error: err.message || "Gmail SMTP send failed.",
    });
  }
}

module.exports = handler;
