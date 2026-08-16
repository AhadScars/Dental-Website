module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    ok: true,
    service: "elegancia-mail",
    vercel: Boolean(process.env.VERCEL),
    hasGmailUser: Boolean(process.env.GMAIL_USER || process.env.SMTP_USER),
    hasGmailPass: Boolean(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS),
  });
};
