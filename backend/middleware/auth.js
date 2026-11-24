const jwt = require("jsonwebtoken");
const db = require("../db");

const COOKIE = "cm_token";

// Runs on every request: if the login cookie is valid, sets req.user. Never blocks by itself.
async function authenticate(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // one query instead of two (every request checks this, and the database is now over the network)
    const row = await db.get(
      `SELECT s.id AS sid, s.ended_at, s.expires_at, u.id, u.username, u.email, u.role, u.is_active
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [payload.sid]
    );
    if (!row || row.ended_at || row.expires_at < new Date().toISOString()) return next();
    if (row.is_active) {
      req.user = { id: row.id, username: row.username, email: row.email, role: row.role, is_active: row.is_active };
      req.sessionId = row.sid;
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

async function investigatorInfo(userId) {
  return (await db.get('SELECT job_type AS "jobType", status FROM investigator_profiles WHERE user_id = ?', [userId])) || null;
}

module.exports = { COOKIE, authenticate, requireLogin, requireRole, investigatorInfo };
