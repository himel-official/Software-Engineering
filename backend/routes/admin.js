const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { ID_DIR, CRIME_TYPES } = require("../config");
const { decrypt, decryptBuffer } = require("../crypto");
const { logAdmin, verifyChain } = require("../audit");
const { clientIp } = require("../ip");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("admin")); // EVERYTHING below is admin-only

const typeLabel = (key) => (CRIME_TYPES.find((t) => t.key === key) || { label: key }).label;
const int = (v) => (Number.isInteger(Number(v)) ? Number(v) : null);

function getUser(req, res) {
  const id = int(req.params.id);
  const u = id ? db.prepare("SELECT * FROM users WHERE id = ?").get(id) : null;
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return u;
}

// ---------- dashboard numbers ----------
router.get("/stats", (req, res) => {
  const n = (sql) => db.prepare(sql).get().n;
  res.json({
    users: n("SELECT COUNT(*) AS n FROM users WHERE role = 'user'"),
    investigatorsVerified: n("SELECT COUNT(*) AS n FROM investigator_profiles WHERE status = 'verified'"),
    investigatorsPending: n("SELECT COUNT(*) AS n FROM investigator_profiles WHERE status = 'unverified'"),
    reportsActive: n("SELECT COUNT(*) AS n FROM reports WHERE status = 'active'"),
    chats: n("SELECT COUNT(*) AS n FROM chat_threads"),
    logEntries: n("SELECT COUNT(*) AS n FROM audit_logs"),
  });
});

// ---------- users ----------
router.get("/users", (req, res) => {
  const role = ["user", "investigator", "admin"].includes(req.query.role) ? req.query.role : "";
  const status = ["verified", "unverified"].includes(req.query.status) ? req.query.status : "";
  const q = String(req.query.q || "").trim().slice(0, 50);
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at, ip.status AS inv_status, ip.job_type
       FROM users u LEFT JOIN investigator_profiles ip ON ip.user_id = u.id
       WHERE (? = '' OR u.role = ?) AND (? = '' OR ip.status = ?) AND (? = '' OR u.username LIKE ? OR u.email LIKE ?)
       ORDER BY u.id DESC LIMIT 500`
    )
    .all(role, role, status, status, q, like, like);
  res.json({ users: rows.map((r) => ({ ...r })) });
});

// Full details, including the decrypted NID. Every view is logged.
router.get("/users/:id", (req, res) => {
  const u = getUser(req, res);
  if (!u) return;

  const detail = {
    id: u.id, username: u.username, email: u.email, role: u.role, isActive: !!u.is_active, createdAt: u.created_at,
    nid: u.nid_enc ? decrypt(u.nid_enc) : null,
    investigator: null,
  };
  if (u.role === "investigator") {
    const p = db.prepare("SELECT * FROM investigator_profiles WHERE user_id = ?").get(u.id);
    if (p) {
      const verifier = p.verified_by ? db.prepare("SELECT username FROM users WHERE id = ?").get(p.verified_by) : null;
      detail.investigator = {
        jobType: p.job_type, status: p.status, verifiedAt: p.verified_at, verifiedBy: verifier ? verifier.username : null,
        idCardMime: p.id_card_mime,
        ...JSON.parse(decrypt(p.details_enc)),
      };
    }
  }
  detail.reports = db
    .prepare("SELECT id, type, description, lat, lng, occurred_at, status FROM reports WHERE user_id = ? ORDER BY id DESC")
    .all(u.id)
    .map((r) => ({ ...r, typeLabel: typeLabel(r.type) }));

  logAdmin({
    admin: req.user, action: "USER_VIEWED", target: { type: "user", id: u.id, username: u.username },
    message: `${req.user.username} viewed the personal details (NID) of ${u.username}`, ip: clientIp(req),
  });
  res.json({ user: detail });
});

// Investigator ID card (decrypted on the fly). Every view is logged.
router.get("/users/:id/id-card", (req, res) => {
  const u = getUser(req, res);
  if (!u) return;
  const p = db.prepare("SELECT * FROM investigator_profiles WHERE user_id = ?").get(u.id);
  if (!p) return res.status(404).json({ error: "No ID card on file" });
  const file = path.join(ID_DIR, path.basename(p.id_card_file));
  if (!fs.existsSync(file)) return res.status(404).json({ error: "ID card file is missing" });

  logAdmin({
    admin: req.user, action: "ID_CARD_VIEWED", target: { type: "user", id: u.id, username: u.username },
    message: `${req.user.username} viewed the ID card of ${u.username}`, ip: clientIp(req),
  });
  res.setHeader("Content-Type", p.id_card_mime);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", "inline");
  res.send(decryptBuffer(fs.readFileSync(file)));
});

// ---------- make a user an admin ----------
// Needs the acting admin's own password. Max 5 tries per 15 minutes per admin.
const promoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `admin-${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});

router.post("/users/:id/make-admin", promoteLimiter, async (req, res) => {
  try {
    const u = getUser(req, res);
    if (!u) return;
    if (u.role === "admin") return res.status(400).json({ error: "This user is already an admin" });

    const password = req.body && req.body.password;
    if (typeof password !== "string" || !password) return res.status(400).json({ error: "Enter your password to confirm" });
    const me = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
    if (!(await bcrypt.compare(password, me.password_hash))) {
      logAdmin({
        admin: req.user, action: "ADMIN_GRANT_DENIED", target: { type: "user", id: u.id, username: u.username },
        message: `${req.user.username} entered a wrong password while trying to make ${u.username} an admin`, ip: clientIp(req),
      });
      return res.status(403).json({ error: "Wrong password" });
    }

    const previousRole = u.role;
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(u.id);
    // End their open sessions: they must log in again, and from now on get the shorter admin session
    db.prepare("UPDATE sessions SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL").run(new Date().toISOString(), u.id);
    logAdmin({
      admin: req.user, action: "ADMIN_GRANTED", target: { type: "user", id: u.id, username: u.username },
      message: `${u.username} (${previousRole}) was made an admin by ${req.user.username}`, ip: clientIp(req),
    });
    res.json({ ok: true, role: "admin" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- verify / revoke investigators ----------
function setVerification(req, res, verified) {
  const u = getUser(req, res);
  if (!u) return;
  const p = u.role === "investigator" ? db.prepare("SELECT * FROM investigator_profiles WHERE user_id = ?").get(u.id) : null;
  if (!p) return res.status(400).json({ error: "This user is not an investigator" });
  const want = verified ? "verified" : "unverified";
  if (p.status === want) return res.status(400).json({ error: `Already ${want}` });

  if (verified) {
    db.prepare("UPDATE investigator_profiles SET status='verified', verified_by=?, verified_at=? WHERE user_id=?").run(req.user.id, new Date().toISOString(), u.id);
  } else {
    db.prepare("UPDATE investigator_profiles SET status='unverified', verified_by=NULL, verified_at=NULL WHERE user_id=?").run(u.id);
  }
  logAdmin({
    admin: req.user, action: verified ? "INVESTIGATOR_VERIFIED" : "INVESTIGATOR_REVOKED",
    target: { type: "user", id: u.id, username: u.username },
    message: verified ? `${u.username} was verified by ${req.user.username}` : `${u.username} was marked unverified by ${req.user.username}`,
    ip: clientIp(req),
  });
  res.json({ ok: true, status: want });
}
router.post("/investigators/:id/verify", (req, res) => setVerification(req, res, true));
router.post("/investigators/:id/revoke", (req, res) => setVerification(req, res, false));

// ---------- reports (moderation) ----------
router.get("/reports", (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.type, r.description, r.lat, r.lng, r.occurred_at, r.created_at, r.status, u.id AS user_id, u.username
       FROM reports r JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT 500`
    )
    .all();
  res.json({ reports: rows.map((r) => ({ ...r, typeLabel: typeLabel(r.type) })) });
});

function setReportHidden(req, res, hide) {
  const id = int(req.params.id);
  const r = id ? db.prepare("SELECT r.*, u.username FROM reports r JOIN users u ON u.id = r.user_id WHERE r.id = ?").get(id) : null;
  if (!r) return res.status(404).json({ error: "Report not found" });
  if (hide) db.prepare("UPDATE reports SET status='hidden', updated_at=? WHERE id=?").run(new Date().toISOString(), r.id);
  else db.prepare("UPDATE reports SET status='active', updated_at=? WHERE id=?").run(new Date().toISOString(), r.id);
  logAdmin({
    admin: req.user, action: hide ? "REPORT_HIDDEN" : "REPORT_UNHIDDEN", target: { type: "report", id: r.id, username: r.username },
    message: `Report #${r.id} (by ${r.username}) was ${hide ? "hidden" : "restored"} by ${req.user.username}`, ip: clientIp(req),
  });
  res.json({ ok: true });
}
router.post("/reports/:id/hide", (req, res) => setReportHidden(req, res, true));
router.post("/reports/:id/unhide", (req, res) => setReportHidden(req, res, false));

// ---------- audit log (read-only: there is NO edit or delete endpoint, and the database blocks it too) ----------
router.get("/logs", (req, res) => {
  const page = Math.max(1, int(req.query.page) || 1);
  const size = 50;
  const total = db.prepare("SELECT COUNT(*) AS n FROM audit_logs").get().n;
  const rows = db
    .prepare("SELECT id, ts, admin_username, action, message, ip, hash FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?")
    .all(size, (page - 1) * size);
  res.json({ total, page, pageSize: size, logs: rows.map((r) => ({ ...r })) });
});

router.get("/logs/verify", (req, res) => res.json(verifyChain()));

// ---------- chats (read-only; every view is logged) ----------
router.get("/chats", (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.id, t.report_id, t.created_at, r.type, iu.username AS investigator, ru.username AS reporter,
              (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id) AS messages
       FROM chat_threads t JOIN reports r ON r.id = t.report_id
       JOIN users iu ON iu.id = t.investigator_id JOIN users ru ON ru.id = t.reporter_id ORDER BY t.id DESC LIMIT 500`
    )
    .all();
  res.json({ threads: rows.map((r) => ({ ...r, typeLabel: typeLabel(r.type) })) });
});

router.get("/chats/:id", (req, res) => {
  const id = int(req.params.id);
  const t = id
    ? db.prepare(
        `SELECT t.id, t.report_id, iu.username AS investigator, ru.username AS reporter, t.investigator_id, t.reporter_id
         FROM chat_threads t JOIN users iu ON iu.id = t.investigator_id JOIN users ru ON ru.id = t.reporter_id WHERE t.id = ?`
      ).get(id)
    : null;
  if (!t) return res.status(404).json({ error: "Chat not found" });
  const msgs = db.prepare("SELECT id, sender_id, body_enc, created_at FROM chat_messages WHERE thread_id = ? ORDER BY id ASC").all(t.id);
  logAdmin({
    admin: req.user, action: "CHAT_VIEWED", target: { type: "chat", id: t.id, username: `${t.investigator}/${t.reporter}` },
    message: `${req.user.username} read chat #${t.id} between ${t.investigator} and ${t.reporter}`, ip: clientIp(req),
  });
  res.json({
    thread: { id: t.id, reportId: t.report_id, investigator: t.investigator, reporter: t.reporter },
    messages: msgs.map((m) => ({ id: m.id, from: m.sender_id === t.investigator_id ? t.investigator : t.reporter, text: decrypt(m.body_enc), createdAt: m.created_at })),
  });
});

module.exports = router;
