const { applyCors, readBody, loadFileConfig, saveFileConfig } = require("../lib/mail");

module.exports = async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST." });
  }

  try {
    const data = await readBody(req);
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
            : "On Vercel, add GMAIL_USER and GMAIL_APP_PASSWORD in Project → Settings → Environment Variables, then redeploy. Visitor bookings cannot use a password saved only in this browser.",
        });
      }
      throw err;
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Could not save SMTP settings." });
  }
};
