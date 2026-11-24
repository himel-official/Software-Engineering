const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const path = require("path");
const db = require("../db");
const { ID_DIR, CHAT_FILE_DIR, CRIME_TYPES } = require("../config");
const storage = require("../storage");
const { decrypt, decryptBuffer } = require("../crypto");
const { sendBuffer, kindOfMime } = require("../files");
const { logAdmin, verifyChain } = require("../audit");
const { clientIp } = require("../ip");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("admin")); // EVERYTHING below is admin-only

const typeLabel = (key) => (CRIME_TYPES.find((t) => t.key === key) || { label: key }).label;
const int = (v) => (Number.isInteger(Number(v)) ? Number(v) : null);

const dbId = (v) => { const n = int(v); return n && n > 0 && n < 2147483647 ? n : null; }; // fits a PostgreSQL integer

async function getUser(req, res) {
  const id = dbId(req.params.id);
  const u = id ? await db.get("SELECT * FROM users WHERE id = ?", [id]) : null;
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return u;
}

// ---------- dashboard numbers ----------
router.get("/stats", async (req, res) => {
  const n = async (sql) => (await db.get(sql)).n;
  const [users, investigatorsVerified, investigatorsPending, reportsActive, chats, logEntries] = await Promise.all([
    n("SELECT COUNT(*) AS n FROM users WHERE role = 'user'"),
    n("SELECT COUNT(*) AS n FROM investigator_profiles WHERE status = 'verified'"),
    n("SELECT COUNT(*) AS n FROM investigator_profiles WHERE status = 'unverified'"),
    n("SELECT COUNT(*) AS n FROM reports WHERE status = 'active'"),
    n("SELECT COUNT(*) AS n FROM chat_threads"),
    n("SELECT COUNT(*) AS n FROM audit_logs"),
  ]);
  res.json({ users, investigatorsVerified, investigatorsPending, reportsActive, chats, logEntries });
});

// ---------- users ----------
router.get("/users", async (req, res) => {
  const role = ["user", "investigator", "admin"].includes(req.query.role) ? req.query.role : "";
  const status = ["verified", "unverified"].includes(req.query.status) ? req.query.status : "";
  const q = String(req.query.q || "").trim().slice(0, 50);
  // ILIKE = case-insensitive search (plain LIKE is case-sensitive in PostgreSQL). Escape % and _ typed by the admin.
  const likeEsc = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db.all(
    `SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at, ip.status AS inv_status, ip.job_type
     FROM users u LEFT JOIN investigator_profiles ip ON ip.user_id = u.id
     WHERE (?::text = '' OR u.role = ?::text) AND (?::text = '' OR ip.status = ?::text) AND (?::text = '' OR u.username ILIKE ? OR u.email ILIKE ?)
     ORDER BY u.id DESC LIMIT 500`,
    [role, role, status, status, q, likeEsc, likeEsc]
  );
  res.json({ users: rows.map((r) => ({ ...r })) });
});

// Full details, including the decrypted NID. Every view is logged.
router.get("/users/:id", async (req, res) => {
  const u = await getUser(req, res);
  if (!u) return;

  const detail = {
    id: u.id, username: u.username, email: u.email, role: u.role, isActive: !!u.is_active, createdAt: u.created_at,
    nid: u.nid_enc ? decrypt(u.nid_enc) : null,
    investigator: null,
  };
  if (u.role === "investigator") {
    const p = await db.get("SELECT * FROM investigator_profiles WHERE user_id = ?", [u.id]);
    if (p) {
      const verifier = p.verified_by ? await db.get("SELECT username FROM users WHERE id = ?", [p.verified_by]) : null;
      detail.investigator = {
        jobType: p.job_type, status: p.status, verifiedAt: p.verified_at, verifiedBy: verifier ? verifier.username : null,
        idCardMime: p.id_card_mime,
        ...JSON.parse(decrypt(p.details_enc)),
      };
    }
  }
  detail.reports = (await db.all("SELECT id, type, description, lat, lng, occurred_at, status FROM reports WHERE user_id = ? ORDER BY id DESC", [u.id])).map(
    (r) => ({ ...r, typeLabel: typeLabel(r.type) })
  );

  // Last recorded location (only the latest point exists; there is no location history)
  const loc = await db.get("SELECT lat, lng, accuracy, updated_at FROM user_locations WHERE user_id = ?", [u.id]);
  detail.lastLocation = loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, updatedAt: loc.updated_at } : null;

  await logAdmin({
    admin: req.user, action: "USER_VIEWED", target: { type: "user", id: u.id, username: u.username },
    message: `${req.user.username} viewed the personal details (NID) and last recorded location of ${u.username} (user #${u.id})`, ip: clientIp(req),
  });
  res.json({ user: detail });
});

// Investigator ID card (decrypted on the fly). Every view is logged.
router.get("/users/:id/id-card", async (req, res) => {
  const u = await getUser(req, res);
  if (!u) return;
  const p = await db.get("SELECT * FROM investigator_profiles WHERE user_id = ?", [u.id]);
  if (!p) return res.status(404).json({ error: "No ID card on file" });
  const stored = await storage.load(ID_DIR, path.basename(p.id_card_file));
  if (!stored) return res.status(404).json({ error: "ID card file is missing" });

  await logAdmin({
    admin: req.user, action: "ID_CARD_VIEWED", target: { type: "user", id: u.id, username: u.username },
    message: `${req.user.username} viewed the ID card of ${u.username}`, ip: clientIp(req),
  });
  res.setHeader("Content-Type", p.id_card_mime);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", "inline");
  res.send(decryptBuffer(stored));
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
    const u = await getUser(req, res);
    if (!u) return;
    if (u.role === "admin") return res.status(400).json({ error: "This user is already an admin" });

    const password = req.body && req.body.password;
    if (typeof password !== "string" || !password) return res.status(400).json({ error: "Enter your password to confirm" });
    const me = await db.get("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    if (!(await bcrypt.compare(password, me.password_hash))) {
      await logAdmin({
        admin: req.user, action: "ADMIN_GRANT_DENIED", target: { type: "user", id: u.id, username: u.username },
        message: `${req.user.username} entered a wrong password while trying to make ${u.username} an admin`, ip: clientIp(req),
      });
      return res.status(403).json({ error: "Wrong password" });
    }

    const previousRole = u.role;
    await db.run("UPDATE users SET role = 'admin' WHERE id = ?", [u.id]);
    // End their open sessions: they must log in again, and from now on get the shorter admin session
    await db.run("UPDATE sessions SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL", [new Date().toISOString(), u.id]);
    await logAdmin({
      admin: req.user, action: "ADMIN_GRANTED", target: { type: "user", id: u.id, username: u.username },
      message: `${u.username} (${previousRole}) was made an admin by ${req.user.username}`, ip: clientIp(req),
    });
    res.json({ ok: true, role: "admin" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- remove admin rights ----------
// Needs the acting admin's own password (same protection as making an admin). The person keeps their account and goes back to
// what they were before: an investigator if they have an investigator profile, otherwise a regular user.
// An admin cannot remove themselves, so there is always at least one admin left.
router.post("/users/:id/remove-admin", promoteLimiter, async (req, res) => {
  try {
    const u = await getUser(req, res);
    if (!u) return;
    if (u.role !== "admin") return res.status(400).json({ error: "This user is not an admin" });
    if (u.id === req.user.id) return res.status(400).json({ error: "You cannot remove your own admin rights. Ask another admin to do it." });
    const admins = (await db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1")).n;
    if (admins <= 1) return res.status(400).json({ error: "There must always be at least one admin" });

    const password = req.body && req.body.password;
    if (typeof password !== "string" || !password) return res.status(400).json({ error: "Enter your password to confirm" });
    const me = await db.get("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    if (!(await bcrypt.compare(password, me.password_hash))) {
      await logAdmin({
        admin: req.user, action: "ADMIN_REMOVE_DENIED", target: { type: "user", id: u.id, username: u.username },
        message: `${req.user.username} entered a wrong password while trying to remove admin rights from ${u.username}`, ip: clientIp(req),
      });
      return res.status(403).json({ error: "Wrong password" });
    }

    const hasProfile = !!(await db.get("SELECT 1 FROM investigator_profiles WHERE user_id = ?", [u.id]));
    const newRole = hasProfile ? "investigator" : "user";
    await db.run("UPDATE users SET role = ? WHERE id = ?", [newRole, u.id]);
    await db.run("UPDATE sessions SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL", [new Date().toISOString(), u.id]);
    await logAdmin({
      admin: req.user, action: "ADMIN_REMOVED", target: { type: "user", id: u.id, username: u.username },
      message: `${req.user.username} removed admin rights from ${u.username} (now ${newRole})`, ip: clientIp(req),
    });
    res.json({ ok: true, role: newRole });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- verify / revoke investigators ----------
async function setVerification(req, res, verified) {
  const u = await getUser(req, res);
  if (!u) return;
  const p = u.role === "investigator" ? await db.get("SELECT * FROM investigator_profiles WHERE user_id = ?", [u.id]) : null;
  if (!p) return res.status(400).json({ error: "This user is not an investigator" });
  const want = verified ? "verified" : "unverified";
  if (p.status === want) return res.status(400).json({ error: `Already ${want}` });

  if (verified) {
    await db.run("UPDATE investigator_profiles SET status='verified', verified_by=?, verified_at=? WHERE user_id=?", [req.user.id, new Date().toISOString(), u.id]);
  } else {
    await db.run("UPDATE investigator_profiles SET status='unverified', verified_by=NULL, verified_at=NULL WHERE user_id=?", [u.id]);
  }
  await logAdmin({
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
router.get("/reports", async (req, res) => {
  const rows = await db.all(
    `SELECT r.id, r.type, r.description, r.lat, r.lng, r.occurred_at, r.created_at, r.status, u.id AS user_id, u.username,
            (SELECT COUNT(*) FROM report_files f WHERE f.report_id = r.id) AS files
     FROM reports r JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT 500`
  );
  res.json({ reports: rows.map((r) => ({ ...r, typeLabel: typeLabel(r.type) })) });
});

async function setReportHidden(req, res, hide) {
  const id = dbId(req.params.id);
  const r = id ? await db.get("SELECT r.*, u.username FROM reports r JOIN users u ON u.id = r.user_id WHERE r.id = ?", [id]) : null;
  if (!r) return res.status(404).json({ error: "Report not found" });
  if (hide) await db.run("UPDATE reports SET status='hidden', updated_at=? WHERE id=?", [new Date().toISOString(), r.id]);
  else await db.run("UPDATE reports SET status='active', updated_at=? WHERE id=?", [new Date().toISOString(), r.id]);
  await logAdmin({
    admin: req.user, action: hide ? "REPORT_HIDDEN" : "REPORT_UNHIDDEN", target: { type: "report", id: r.id, username: r.username },
    message: `Report #${r.id} (by ${r.username}) was ${hide ? "hidden" : "restored"} by ${req.user.username}`, ip: clientIp(req),
  });
  res.json({ ok: true });
}
router.post("/reports/:id/hide", (req, res) => setReportHidden(req, res, true));
router.post("/reports/:id/unhide", (req, res) => setReportHidden(req, res, false));

// ---------- audit log (read-only: there is NO edit or delete endpoint, and the database blocks it too) ----------
router.get("/logs", async (req, res) => {
  const page = Math.min(1000000, Math.max(1, int(req.query.page) || 1));
  const size = 50;
  const total = (await db.get("SELECT COUNT(*) AS n FROM audit_logs")).n;
  const rows = await db.all("SELECT id, ts, admin_username, action, message, ip, hash FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?", [size, (page - 1) * size]);
  res.json({ total, page, pageSize: size, logs: rows.map((r) => ({ ...r })) });
});

router.get("/logs/verify", async (req, res) => res.json(await verifyChain()));

// ---------- chats (read-only; every view is logged) ----------
router.get("/chats", async (req, res) => {
  const rows = await db.all(
    `SELECT t.id, t.report_id, t.created_at, r.type, iu.username AS investigator, ru.username AS reporter,
            t.investigator_id, t.reporter_id,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id) AS messages
     FROM chat_threads t JOIN reports r ON r.id = t.report_id
     JOIN users iu ON iu.id = t.investigator_id JOIN users ru ON ru.id = t.reporter_id ORDER BY t.id DESC LIMIT 500`
  );
  res.json({ threads: rows.map((r) => ({ ...r, typeLabel: typeLabel(r.type) })) });
});

router.get("/chats/:id", async (req, res) => {
  const id = dbId(req.params.id);
  const t = id
    ? await db.get(
        `SELECT t.id, t.report_id, iu.username AS investigator, ru.username AS reporter, t.investigator_id, t.reporter_id
         FROM chat_threads t JOIN users iu ON iu.id = t.investigator_id JOIN users ru ON ru.id = t.reporter_id WHERE t.id = ?`,
        [id]
      )
    : null;
  if (!t) return res.status(404).json({ error: "Chat not found" });
  const msgs = await db.all("SELECT id, sender_id, body_enc, created_at FROM chat_messages WHERE thread_id = ? ORDER BY id ASC", [t.id]);
  await logAdmin({
    admin: req.user, action: "CHAT_VIEWED", target: { type: "chat", id: t.id, username: `${t.investigator}/${t.reporter}` },
    message: `${req.user.username} read chat #${t.id} between ${t.investigator} and ${t.reporter}`, ip: clientIp(req),
  });
  const files = {};
  if (msgs.length) {
    const rows = await db.all(
      `SELECT id, message_id, name_enc, mime, size FROM chat_files WHERE message_id IN (${msgs.map(() => "?").join(",")})`,
      msgs.map((m) => m.id)
    );
    for (const f of rows) files[f.message_id] = { id: f.id, name: decrypt(f.name_enc), mime: f.mime, kind: kindOfMime(f.mime), size: f.size };
  }
  res.json({
    thread: { id: t.id, reportId: t.report_id, investigator: t.investigator, reporter: t.reporter },
    messages: msgs.map((m) => ({
      id: m.id, from: m.sender_id === t.investigator_id ? `${t.investigator} (investigator #${t.investigator_id})` : `${t.reporter} (reporter #${t.reporter_id})`,
      text: decrypt(m.body_enc), file: files[m.id] || null, createdAt: m.created_at,
    })),
  });
});

// A file from a private chat. Admins may open it, and every time they do it is written to the permanent log.
router.get("/chats/:id/files/:fileId", async (req, res) => {
  const id = dbId(req.params.id);
  const fileId = dbId(req.params.fileId);
  const f = id && fileId ? await db.get("SELECT * FROM chat_files WHERE id = ? AND thread_id = ?", [fileId, id]) : null;
  if (!f) return res.status(404).json({ error: "File not found" });
  const stored = await storage.load(CHAT_FILE_DIR, path.basename(f.stored_name));
  if (!stored) return res.status(404).json({ error: "File is missing" });
  const name = decrypt(f.name_enc);
  // Browsers fetch a video in several parts: only log the first request of each viewing
  if (!req.headers.range || /^bytes=0-/.test(req.headers.range)) {
    await logAdmin({
      admin: req.user, action: "CHAT_FILE_VIEWED", target: { type: "chat", id, username: `file #${f.id}` },
      message: `${req.user.username} opened file "${name}" (${f.mime}) in chat #${id}`, ip: clientIp(req),
    });
  }
  sendBuffer(req, res, decryptBuffer(stored), { mime: f.mime, name });
});

module.exports = router;
