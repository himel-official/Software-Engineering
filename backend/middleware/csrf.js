// Simple CSRF protection: every change request must carry a custom header
// that other websites cannot add. (The login cookie is also SameSite=Strict.)
module.exports = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("x-requested-with") !== "crimemap") return res.status(403).json({ error: "Blocked request" });
  next();
};
