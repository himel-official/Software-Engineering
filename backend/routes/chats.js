const express = require("express");
const db = require("../db");
const { CRIME_TYPES } = require("../config");
const { encrypt, decrypt } = require("../crypto");
const { requireRole, investigatorInfo } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("user", "investigator"));

const typeLabel = (key) => (CRIME_TYPES.find((t) => t.key === key) || { label: key }).label;

// How the OTHER person is shown. Reporters stay anonymous to investigators.
function describeThread(t, viewerRole) {
  if (viewerRole === "investigator") {
    return { id: t.id, title: "Anonymous reporter", username: null, subtitle: `Report #${t.report_id} - ${typeLabel(t.type)}`, jobType: null, status: null };
  }
  return {
    id: t.id, title: t.investigator_username, username: t.investigator_username,
    subtitle: `About your report #${t.report_id} - ${typeLabel(t.type)}`, jobType: t.job_type, status: t.status,
  };
}

const THREAD_SQL = `
  SELECT t.id, t.report_id, t.investigator_id, t.reporter_id, t.created_at, r.type,
         iu.username AS investigator_username, ip.job_type, ip.status
  FROM chat_threads t
  JOIN reports r ON r.id = t.report_id
  JOIN users iu ON iu.id = t.investigator_id
  LEFT JOIN investigator_profiles ip ON ip.user_id = iu.id`;

function myThread(req, res) {
  const id = Number(req.params.id);
  const t = Number.isInteger(id) ? db.prepare(THREAD_SQL + " WHERE t.id = ?").get(id) : null;
  if (!t || (t.investigator_id !== req.user.id && t.reporter_id !== req.user.id)) {
    res.status(404).json({ error: "Chat not found" });
    return null;
  }
  return t;
}

function cleanMessage(m) {
  const s = String(m || "").trim();
  return s.length >= 1 && s.length <= 2000 ? s : null;
}

// Number of unread messages in ONE chat (messages from the other person newer than my last read)
function unreadInThread(threadId, userId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM chat_messages m
       WHERE m.thread_id = ? AND m.sender_id != ?
         AND m.id > COALESCE((SELECT last_read_id FROM chat_reads WHERE thread_id = ? AND user_id = ?), 0)`
    )
    .get(threadId, userId, threadId, userId).n;
}

// Total unread messages across all my chats (shown on the Messages button)
router.get("/unread", (req, res) => {
  const u = req.user.id;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id
       WHERE (t.investigator_id = ? OR t.reporter_id = ?) AND m.sender_id != ?
         AND m.id > COALESCE((SELECT r.last_read_id FROM chat_reads r WHERE r.thread_id = t.id AND r.user_id = ?), 0)`
    )
    .get(u, u, u, u);
  res.json({ count: row.n });
});

// My chats
router.get("/", (req, res) => {
  const rows = db.prepare(THREAD_SQL + " WHERE t.investigator_id = ? OR t.reporter_id = ? ORDER BY t.id DESC").all(req.user.id, req.user.id);
  const threads = rows.map((t) => {
    const last = db.prepare("SELECT body_enc, created_at FROM chat_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1").get(t.id);
    return {
      ...describeThread(t, req.user.role),
      lastMessage: last ? decrypt(last.body_enc).slice(0, 80) : "",
      lastAt: last ? last.created_at : t.created_at,
      unread: unreadInThread(t.id, req.user.id),
    };
  });
  res.json({ threads });
});

// An investigator starts a chat with the reporter of a report
router.post("/", requireRole("investigator"), (req, res) => {
  const info = investigatorInfo(req.user.id);
  if (!info || info.status !== "verified") {
    return res.status(403).json({ error: "Only verified investigators can contact reporters. Wait for an admin to verify your ID." });
  }
  const message = cleanMessage(req.body.message);
  if (!message) return res.status(400).json({ error: "Message must be 1 to 2000 characters" });

  const report = db.prepare("SELECT id, user_id FROM reports WHERE id = ? AND status = 'active'").get(Number(req.body.reportId));
  if (!report) return res.status(404).json({ error: "Report not found" });

  db.prepare("INSERT OR IGNORE INTO chat_threads (report_id, investigator_id, reporter_id) VALUES (?, ?, ?)").run(report.id, req.user.id, report.user_id);
  const thread = db.prepare("SELECT id FROM chat_threads WHERE report_id = ? AND investigator_id = ?").get(report.id, req.user.id);
  db.prepare("INSERT INTO chat_messages (thread_id, sender_id, body_enc) VALUES (?, ?, ?)").run(thread.id, req.user.id, encrypt(message));
  res.status(201).json({ threadId: thread.id });
});

// Messages of one chat (?after=ID returns only newer messages, used for live updates).
// Opening a chat marks what it returns as read.
router.get("/:id", (req, res) => {
  const t = myThread(req, res);
  if (!t) return;
  const after = Number(req.query.after) || 0;
  const msgs = db.prepare("SELECT id, sender_id, body_enc, created_at FROM chat_messages WHERE thread_id = ? AND id > ? ORDER BY id ASC").all(t.id, after);

  if (msgs.length) {
    db.prepare(
      `INSERT INTO chat_reads (thread_id, user_id, last_read_id) VALUES (?, ?, ?)
       ON CONFLICT(thread_id, user_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`
    ).run(t.id, req.user.id, msgs[msgs.length - 1].id);
  }

  res.json({
    thread: describeThread(t, req.user.role),
    messages: msgs.map((m) => ({ id: m.id, mine: m.sender_id === req.user.id, text: decrypt(m.body_enc), createdAt: m.created_at })),
  });
});

// Send a message. There is no edit or delete: chats are permanent.
router.post("/:id/messages", (req, res) => {
  const t = myThread(req, res);
  if (!t) return;
  const message = cleanMessage(req.body.message);
  if (!message) return res.status(400).json({ error: "Message must be 1 to 2000 characters" });
  db.prepare("INSERT INTO chat_messages (thread_id, sender_id, body_enc) VALUES (?, ?, ?)").run(t.id, req.user.id, encrypt(message));
  res.status(201).json({ ok: true });
});

module.exports = router;
