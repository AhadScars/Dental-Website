const { applyCors, status } = require("../lib/mail");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(200).json(status());
};
