const express = require("express");
const crypto = require("crypto");
const path = require("path");
const db = require("../db");
const { CRIME_TYPES, CHAT_FILE_DIR } = require("../config");
const storage = require("../storage");
const { encrypt, decrypt, encryptBuffer, decryptBuffer } = require("../crypto");
const { requireRole, investigatorInfo } = require("../middleware/auth");
const { detectFile, uploader, sendBuffer, kindOfMime, WRONG_TYPE } = require("../files");

const router = express.Router();
router.use(requireRole("user", "investigator"));

const typeLabel = (key) => (CRIME_TYPES.find((t) => t.key === key) || { label: key }).label;

// How the OTHER person is shown. The reporter of a report stays anonymous to the investigator who contacts them.
// (Decided per chat, not per role: an investigator can also be the reporter of a crime.)
function describeThread(t, viewerId) {
  if (viewerId === t.reporter_id) {
    return {
      id: t.id, title: t.investigator_username, username: t.investigator_username, investigatorId: t.investigator_id,
      subtitle: `About your report #${t.report_id} - ${typeLabel(t.type)}`, jobType: t.job_type, status: t.status,
    };
  }
  return { id: t.id, title: "Anonymous reporter", username: null, investigatorId: null, subtitle: `Report #${t.report_id} - ${typeLabel(t.type)}`, jobType: null, status: null };
}

const THREAD_SQL = `
  SELECT t.id, t.report_id, t.investigator_id, t.reporter_id, t.created_at, r.type,
         iu.username AS investigator_username, ip.job_type, ip.status
  FROM chat_threads t
  JOIN reports r ON r.id = t.report_id
  JOIN users iu ON iu.id = t.investigator_id
  LEFT JOIN investigator_profiles ip ON ip.user_id = iu.id`;

const validId = (n) => Number.isInteger(n) && n > 0 && n < 2147483647;

async function myThread(req, res) {
  const id = Number(req.params.id);
  const t = validId(id) ? await db.get(THREAD_SQL + " WHERE t.id = ?", [id]) : null;
  if (!t || (t.investigator_id !== req.user.id && t.reporter_id !== req.user.id)) {
    res.status(404).json({ error: "Chat not found" });
    return null;
  }
  return t;
}

function cleanMessage(m, allowEmpty = false) {
  const s = String(m || "").trim();
  if (s.length === 0) return allowEmpty ? "" : null;
  return s.length <= 2000 ? s : null;
}

// Attachment info for a list of message ids -> { messageId: file }
async function filesForMessages(ids) {
  if (!ids.length) return {};
  const rows = await db.all(`SELECT id, message_id, name_enc, mime, size FROM chat_files WHERE message_id IN (${ids.map(() => "?").join(",")})`, ids);
  const out = {};
  for (const f of rows) out[f.message_id] = { id: f.id, name: decrypt(f.name_enc), mime: f.mime, kind: kindOfMime(f.mime), size: f.size };
  return out;
}

// Number of unread messages in ONE chat (messages from the other person newer than my last read)
async function unreadInThread(threadId, userId) {
  const row = await db.get(
    `SELECT COUNT(*) AS n FROM chat_messages m
     WHERE m.thread_id = ? AND m.sender_id != ?
       AND m.id > COALESCE((SELECT last_read_id FROM chat_reads WHERE thread_id = ? AND user_id = ?), 0)`,
    [threadId, userId, threadId, userId]
  );
  return row.n;
}

// Total unread messages across all my chats (shown on the Messages button)
router.get("/unread", async (req, res) => {
  const u = req.user.id;
  const row = await db.get(
    `SELECT COUNT(*) AS n FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id
     WHERE (t.investigator_id = ? OR t.reporter_id = ?) AND m.sender_id != ?
       AND m.id > COALESCE((SELECT r.last_read_id FROM chat_reads r WHERE r.thread_id = t.id AND r.user_id = ?), 0)`,
    [u, u, u, u]
  );
  res.json({ count: row.n });
});

// My chats
router.get("/", async (req, res) => {
  const rows = await db.all(THREAD_SQL + " WHERE t.investigator_id = ? OR t.reporter_id = ? ORDER BY t.id DESC", [req.user.id, req.user.id]);
  const threads = await Promise.all(rows.map(async (t) => {
    const last = await db.get("SELECT id, body_enc, created_at FROM chat_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1", [t.id]);
    let preview = "";
    if (last) {
      preview = decrypt(last.body_enc).slice(0, 80);
      if (!preview) {
        const f = (await filesForMessages([last.id]))[last.id];
        preview = f ? `📎 ${f.name}` : "";
      }
    }
    return {
      ...describeThread(t, req.user.id),
      lastMessage: preview,
      lastAt: last ? last.created_at : t.created_at,
      unread: await unreadInThread(t.id, req.user.id),
    };
  }));
  res.json({ threads });
});

// An investigator starts a chat with the reporter of a report
router.post("/", requireRole("investigator"), async (req, res) => {
  const info = await investigatorInfo(req.user.id);
  if (!info || info.status !== "verified") {
    return res.status(403).json({ error: "Only verified investigators can contact reporters. Wait for an admin to verify your ID." });
  }
  const message = cleanMessage(req.body.message);
  if (!message) return res.status(400).json({ error: "Message must be 1 to 2000 characters" });

  const reportId = Number(req.body.reportId);
  const report = validId(reportId) ? await db.get("SELECT id, user_id FROM reports WHERE id = ? AND status = 'active'", [reportId]) : null;
  if (!report) return res.status(404).json({ error: "Report not found" });
  if (report.user_id === req.user.id) return res.status(400).json({ error: "This is your own report" });

  await db.run("INSERT INTO chat_threads (report_id, investigator_id, reporter_id) VALUES (?, ?, ?) ON CONFLICT (report_id, investigator_id) DO NOTHING", [report.id, req.user.id, report.user_id]);
  const thread = await db.get("SELECT id FROM chat_threads WHERE report_id = ? AND investigator_id = ?", [report.id, req.user.id]);
  await db.run("INSERT INTO chat_messages (thread_id, sender_id, body_enc) VALUES (?, ?, ?)", [thread.id, req.user.id, encrypt(message)]);
  res.status(201).json({ threadId: thread.id });
});

// Messages of one chat (?after=ID returns only newer messages, used for live updates).
// Opening a chat marks what it returns as read.
router.get("/:id", async (req, res) => {
  const t = await myThread(req, res);
  if (!t) return;
  const afterRaw = Number(req.query.after);
  const after = Number.isInteger(afterRaw) && afterRaw > 0 && afterRaw < 2147483647 ? afterRaw : 0;
  const msgs = await db.all("SELECT id, sender_id, body_enc, created_at FROM chat_messages WHERE thread_id = ? AND id > ? ORDER BY id ASC", [t.id, after]);

  if (msgs.length) {
    await db.run(
      `INSERT INTO chat_reads (thread_id, user_id, last_read_id) VALUES (?, ?, ?)
       ON CONFLICT(thread_id, user_id) DO UPDATE SET last_read_id = GREATEST(chat_reads.last_read_id, excluded.last_read_id)`,
      [t.id, req.user.id, msgs[msgs.length - 1].id]
    );
  }
  const files = await filesForMessages(msgs.map((m) => m.id));

  res.json({
    thread: describeThread(t, req.user.id),
    messages: msgs.map((m) => ({ id: m.id, mine: m.sender_id === req.user.id, text: decrypt(m.body_enc), file: files[m.id] || null, createdAt: m.created_at })),
  });
});

// Send a message, optionally with ONE file (picture, video, PDF or document, max 25 MB).
// The file is stored encrypted. There is no edit or delete: chats are permanent.
router.post("/:id/messages", uploader("file", 1), async (req, res) => {
  const t = await myThread(req, res);
  if (!t) return;
  const file = req.file || null;
  const message = cleanMessage(req.body.message, !!file);
  if (message === null) return res.status(400).json({ error: "Message must be 1 to 2000 characters" });

  let kind = null;
  if (file) {
    kind = detectFile(file.buffer, file.originalname);
    if (!kind) return res.status(400).json({ error: WRONG_TYPE });
  }

  let stored = null;
  try {
    try {
      await db.tx(async (tx) => {
        const messageId = await tx.insert("INSERT INTO chat_messages (thread_id, sender_id, body_enc) VALUES (?, ?, ?)", [t.id, req.user.id, encrypt(message)]);
        if (file) {
          stored = crypto.randomBytes(24).toString("hex") + ".enc";
          await storage.save(CHAT_FILE_DIR, stored, encryptBuffer(file.buffer), "application/octet-stream");
          const shownName = (path.basename(file.originalname || "file") || "file").slice(0, 120);
          await tx.run("INSERT INTO chat_files (message_id, thread_id, stored_name, name_enc, mime, size) VALUES (?, ?, ?, ?, ?, ?)", [
            messageId, t.id, stored, encrypt(shownName), kind.mime, file.buffer.length,
          ]);
        }
      });
    } catch (e) {
      if (stored) await storage.remove(CHAT_FILE_DIR, stored);
      throw e;
    }
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Open an attachment. Only the two people in the chat can do this (admins use their own, logged, route).
router.get("/:id/files/:fileId", async (req, res) => {
  const t = await myThread(req, res);
  if (!t) return;
  const fileId = Number(req.params.fileId);
  const f = validId(fileId) ? await db.get("SELECT * FROM chat_files WHERE id = ? AND thread_id = ?", [fileId, t.id]) : null;
  if (!f) return res.status(404).json({ error: "File not found" });
  const stored = await storage.load(CHAT_FILE_DIR, path.basename(f.stored_name));
  if (!stored) return res.status(404).json({ error: "File is missing" });
  sendBuffer(req, res, decryptBuffer(stored), { mime: f.mime, name: decrypt(f.name_enc) });
});

module.exports = router;
