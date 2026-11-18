const jwt = require("jsonwebtoken");
const db = require("../db");

const COOKIE = "cm_token";

// Runs on every request: if the login cookie is valid, sets req.user. Never blocks by itself.
function authenticate(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const s = db.prepare("SELECT * FROM sessions WHERE id = ?").get(payload.sid);
    if (!s || s.ended_at || s.expires_at < new Date().toISOString()) return next();
    const u = db.prepare("SELECT id, username, email, role, is_active FROM users WHERE id = ?").get(s.user_id);
    if (u && u.is_active) {
      req.user = { ...u };
      req.sessionId = s.id;
    }
  } catch {
    /* invalid token: treat as logged out */
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please log in first" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Please log in first" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "You are not allowed to do this" });
    next();
  };
}

function investigatorInfo(userId) {
  return db.prepare("SELECT job_type AS jobType, status FROM investigator_profiles WHERE user_id = ?").get(userId) || null;
}

module.exports = { COOKIE, authenticate, requireLogin, requireRole, investigatorInfo };
