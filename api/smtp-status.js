const { applyCors, jsonError, status } = require("../lib/mail");

module.exports = async function handler(req, res) {
  try {
    applyCors(res);
    if (req.method === "OPTIONS") return res.status(204).end();
    return res.status(200).json(status());
  } catch (err) {
    return jsonError(res, err, "Could not read SMTP status.");
  }
};
