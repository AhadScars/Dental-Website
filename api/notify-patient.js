const { applyCors, readBody, sendPatientStatusEmail } = require("../lib/mail");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST." });
  }

  try {
    const data = await readBody(req);
    data.kind = "patient-status";
    const to = String(data.to || data.patientEmail || data.email || "").trim();
    if (!to || to.indexOf("@") === -1) {
      return res.status(400).json({ ok: false, error: "This booking has no patient email to notify." });
    }
    data.to = to;
    data.email = to;
    await sendPatientStatusEmail(data);
    return res.status(200).json({ ok: true, to: to });
  } catch (err) {
    const status = err.status || (String(err.message || "").includes("Invalid login") ? 401 : 500);
    return res.status(status).json({
      ok: false,
      error: err.message || "Could not email the patient.",
    });
  }
};
