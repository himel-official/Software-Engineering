const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");
const db = require("../db");
const { CRIME_TYPES, REPORT_FILE_DIR, MAX_REPORT_FILES } = require("../config");
const storage = require("../storage");
const { requireRole, investigatorInfo } = require("../middleware/auth");
const { detectFile, stripJpegMetadata, uploader, sendBuffer, kindOfMime, WRONG_TYPE } = require("../files");
const { round3 } = require("../geo");
const { notifyNearbyUsers } = require("../notify");

const router = express.Router();

// Regular users AND investigators (police / journalists) can file crime reports.
const reporters = requireRole("user", "investigator");

// Exact coordinates are only for admins and VERIFIED investigators.
// Everyone else sees locations rounded to ~110 m, so a reporter's exact spot is not exposed.
async function canSeeExact(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "investigator") {
    const i = await investigatorInfo(user.id);
    return !!i && i.status === "verified";
  }
  return false;
}

const fileMeta = (f) => ({ id: f.id, mime: f.mime, kind: kindOfMime(f.mime), size: f.size });

// { reportId: [file, ...] }
async function filesByReport(whereSql, ...params) {
  const rows = await db.all(`SELECT id, report_id, mime, size FROM report_files WHERE ${whereSql} ORDER BY id`, params);
  const out = {};
  for (const f of rows) (out[f.report_id] ||= []).push(fileMeta(f));
  return out;
}

// Never includes the reporter's identity (only a "mine" flag for the logged-in person's own reports).
router.get("/map", async (req, res) => {
  const exact = await canSeeExact(req.user);
  const rows = await db.all(
    "SELECT id, user_id, type, description, lat, lng, occurred_at, created_at FROM reports WHERE status = 'active' ORDER BY occurred_at DESC LIMIT 5000"
  );
  const files = await filesByReport("report_id IN (SELECT id FROM reports WHERE status = 'active')");
  res.json({
    exact,
    reports: rows.map(({ user_id, ...r }) => ({
      ...r,
      lat: exact ? r.lat : round3(r.lat),
      lng: exact ? r.lng : round3(r.lng),
      mine: !!req.user && user_id === req.user.id,
      files: files[r.id] || [],
    })),
  });
});

function parseReport(body) {
  const type = CRIME_TYPES.find((t) => t.key === body.type);
  if (!type) return { error: "Please choose a crime type" };
  const description = String(body.description || "").trim();
  if (description.length < 10 || description.length > 1000) return { error: "Description must be 10 to 1000 characters" };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: "Please pick the location on the map" };
  }
  const occurred = new Date(body.occurredAt);
  if (isNaN(occurred.getTime())) return { error: "Please enter when it happened" };
  if (occurred.getTime() > Date.now() + 5 * 60 * 1000) return { error: "The date cannot be in the future" };
  return { value: { type: type.key, description, lat, lng, occurredAt: occurred.toISOString() } };
}

// Checks every uploaded file. Returns { files: [{buf, ext, mime}] } or { error }.
function checkUploads(req) {
  const out = [];
  for (const f of req.files || []) {
    const t = detectFile(f.buffer, f.originalname);
    if (!t) return { error: WRONG_TYPE };
    // Public pictures lose their GPS / camera data
    out.push({ buf: t.ext === "jpg" ? stripJpegMetadata(f.buffer) : f.buffer, ext: t.ext, mime: t.mime });
  }
  return { files: out };
}

// Uploads the files to Supabase Storage and records them.
async function saveFiles(reportId, files) {
  const written = [];
  const insertSql = "INSERT INTO report_files (report_id, stored_name, mime, size) VALUES (?, ?, ?, ?)";
  try {
    for (const f of files) {
      const name = crypto.randomBytes(20).toString("hex") + "." + f.ext;
      await storage.save(REPORT_FILE_DIR, name, f.buf, f.mime);
      written.push(name);
      await db.run(insertSql, [reportId, name, f.mime, f.buf.length]);
    }
  } catch (e) {
    for (const n of written) await storage.remove(REPORT_FILE_DIR, n);
    throw e;
  }
}

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `user-${req.user.id}`, // limit per account, no IP needed
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You are posting too fast. Please try again later." },
});

// Create a report (multipart form: fields + up to MAX_REPORT_FILES files in "files")
router.post("/", reporters, createLimiter, uploader("files", MAX_REPORT_FILES), async (req, res) => {
  try {
    const p = parseReport(req.body || {});
    if (p.error) return res.status(400).json({ error: p.error });
    const up = checkUploads(req);
    if (up.error) return res.status(400).json({ error: up.error });

    const r = p.value;
    const id = await db.insert("INSERT INTO reports (user_id, type, description, lat, lng, occurred_at) VALUES (?, ?, ?, ?, ?, ?)", [
      req.user.id, r.type, r.description, r.lat, r.lng, r.occurredAt,
    ]);
    await saveFiles(id, up.files);

    // Alert everyone within 5 km (never blocks the report if alerting fails)
    try {
      await notifyNearbyUsers({ id, user_id: req.user.id, lat: r.lat, lng: r.lng });
    } catch (e) {
      console.error("Could not create alerts:", e);
    }
    res.status(201).json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// My own reports (exact location, because it is my own data)
router.get("/mine", reporters, async (req, res) => {
  const rows = await db.all(
    `SELECT id, type, description, lat, lng, occurred_at, created_at, status,
            (SELECT COUNT(*) FROM chat_threads t WHERE t.report_id = reports.id) AS investigators_contacted
     FROM reports WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user.id]
  );
  const files = await filesByReport("report_id IN (SELECT id FROM reports WHERE user_id = ?)", req.user.id);
  res.json({ reports: rows.map((r) => ({ ...r, files: files[r.id] || [] })) });
});

async function ownReport(req, res) {
  const id = Number(req.params.id);
  const r = Number.isInteger(id) && Math.abs(id) < 2147483647 ? await db.get("SELECT * FROM reports WHERE id = ? AND user_id = ?", [id, req.user.id]) : null;
  if (!r) {
    res.status(404).json({ error: "Report not found" });
    return null;
  }
  return r;
}

// Edit my report (can also remove old attachments with "removeFileIds" and add new files)
router.put("/:id", reporters, uploader("files", MAX_REPORT_FILES), async (req, res) => {
  try {
    const r = await ownReport(req, res);
    if (!r) return;
    if (r.status === "hidden") return res.status(403).json({ error: "This report was hidden by a moderator" });
    const p = parseReport(req.body || {});
    if (p.error) return res.status(400).json({ error: p.error });
    const up = checkUploads(req);
    if (up.error) return res.status(400).json({ error: up.error });

    let removeIds = [];
    try {
      const raw = req.body.removeFileIds;
      removeIds = raw ? JSON.parse(raw) : [];
    } catch { /* ignore */ }
    if (!Array.isArray(removeIds)) removeIds = [];
    const existing = await db.all("SELECT id, stored_name FROM report_files WHERE report_id = ?", [r.id]);
    const toRemove = existing.filter((f) => removeIds.includes(f.id));
    if (existing.length - toRemove.length + up.files.length > MAX_REPORT_FILES) {
      return res.status(400).json({ error: `A report can have at most ${MAX_REPORT_FILES} attachments` });
    }

    const v = p.value;
    await db.run("UPDATE reports SET type=?, description=?, lat=?, lng=?, occurred_at=?, status='active', updated_at=? WHERE id=?", [
      v.type, v.description, v.lat, v.lng, v.occurredAt, new Date().toISOString(), r.id,
    ]);
    for (const f of toRemove) {
      await db.run("DELETE FROM report_files WHERE id = ?", [f.id]);
      await storage.remove(REPORT_FILE_DIR, path.basename(f.stored_name));
    }
    await saveFiles(r.id, up.files);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Withdraw my report (removed from the map; stays in the database so existing chats keep their context)
router.delete("/:id", reporters, async (req, res) => {
  const r = await ownReport(req, res);
  if (!r) return;
  if (r.status === "hidden") return res.status(403).json({ error: "This report was hidden by a moderator" });
  await db.run("UPDATE reports SET status='withdrawn', updated_at=? WHERE id=?", [new Date().toISOString(), r.id]);
  res.json({ ok: true });
});

// A report attachment. Public while the report is visible; after it is withdrawn or hidden only the owner and admins can open it.
router.get("/files/:fileId", async (req, res) => {
  const id = Number(req.params.fileId);
  const f = Number.isInteger(id) && Math.abs(id) < 2147483647
    ? await db.get("SELECT f.*, r.status, r.user_id FROM report_files f JOIN reports r ON r.id = f.report_id WHERE f.id = ?", [id])
    : null;
  const allowed = f && (f.status === "active" || (req.user && (req.user.role === "admin" || req.user.id === f.user_id)));
  if (!allowed) return res.status(404).json({ error: "File not found" });

  const stored = await storage.load(REPORT_FILE_DIR, path.basename(f.stored_name));
  if (!stored) return res.status(404).json({ error: "File is missing" });
  const ext = path.extname(f.stored_name).slice(1);
  sendBuffer(req, res, stored, { mime: f.mime, name: `safevoice-attachment-${f.id}.${ext}` }); // supports Range requests, so videos can be skipped through
});

module.exports = router;
