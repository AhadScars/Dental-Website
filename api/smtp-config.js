const { applyCors } = require("../lib/mail");

module.exports = async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(400).json({
    ok: false,
    vercel: true,
    error:
      "On Vercel the Gmail App Password cannot be saved from the admin page. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel → Project → Settings → Environment Variables, then redeploy.",
  });
};
