// Real client IP (only ever used for ADMIN audit log entries).
module.exports.clientIp = (req) => (req.ip || "unknown").replace(/^::ffff:/, "");
