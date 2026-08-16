const { applyCors, readBody, jsonError, sendAppointmentEmail, sendPatientStatusEmail } = require("../lib/mail");

async function handler(req, res) {
  try {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST." });
  }

    const data = await readBody(req);
    const action = String(data.action || "").toLowerCase();
    const patientTo = String(data.to || data.patientEmail || "").trim();
    const isPatientStatus =
      data.kind === "patient-status" ||
      action === "confirmed" ||
      action === "rejected" ||
      action === "rescheduled" ||
      Boolean(patientTo);

    if (isPatientStatus) {
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
  } catch (err) {
    return jsonError(res, err, "Gmail SMTP send failed.");
  }
}

module.exports = handler;
