const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { CRIME_TYPES } = require("../config");
const { requireRole, investigatorInfo } = require("../middleware/auth");

const router = express.Router();

const round3 = (n) => Math.round(n * 1000) / 1000; // ~110 m precision

// Exact coordinates are only for admins and VERIFIED investigators.
// Everyone else sees locations rounded to ~110 m, so a reporter's exact spot is not exposed.
function canSeeExact(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "investigator") {
    const i = investigatorInfo(user.id);
    return !!i && i.status === "verified";
  }
  return false;
}

// Never includes the reporter's identity.
router.get("/map", (req, res) => {
  const exact = canSeeExact(req.user);
  const rows = db
    .prepare("SELECT id, type, description, lat, lng, occurred_at, created_at FROM reports WHERE status = 'active' ORDER BY occurred_at DESC LIMIT 5000")
    .all();
  res.json({
    exact,
    reports: rows.map((r) => ({ ...r, lat: exact ? r.lat : round3(r.lat), lng: exact ? r.lng : round3(r.lng) })),
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

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `user-${req.user.id}`, // limit per account, no IP needed
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You are posting too fast. Please try again later." },
});

// Create a report (regular users only)
router.post("/", requireRole("user"), createLimiter, (req, res) => {
  const p = parseReport(req.body);
  if (p.error) return res.status(400).json({ error: p.error });
  const r = p.value;
  const result = db
    .prepare("INSERT INTO reports (user_id, type, description, lat, lng, occurred_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(req.user.id, r.type, r.description, r.lat, r.lng, r.occurredAt);
  res.status(201).json({ id: result.lastInsertRowid });
});

// My own reports (exact location, because it is my own data)
router.get("/mine", requireRole("user"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, type, description, lat, lng, occurred_at, created_at, status,
              (SELECT COUNT(*) FROM chat_threads t WHERE t.report_id = reports.id) AS investigators_contacted
       FROM reports WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.user.id);
  res.json({ reports: rows.map((r) => ({ ...r })) });
});

function ownReport(req, res) {
  const id = Number(req.params.id);
  const r = Number.isInteger(id) ? db.prepare("SELECT * FROM reports WHERE id = ? AND user_id = ?").get(id, req.user.id) : null;
  if (!r) {
    res.status(404).json({ error: "Report not found" });
    return null;
  }
  return r;
}

// Edit my report
router.put("/:id", requireRole("user"), (req, res) => {
  const r = ownReport(req, res);
  if (!r) return;
  if (r.status === "hidden") return res.status(403).json({ error: "This report was hidden by a moderator" });
  const p = parseReport(req.body);
  if (p.error) return res.status(400).json({ error: p.error });
  const v = p.value;
  db.prepare("UPDATE reports SET type=?, description=?, lat=?, lng=?, occurred_at=?, status='active', updated_at=? WHERE id=?").run(
    v.type, v.description, v.lat, v.lng, v.occurredAt, new Date().toISOString(), r.id
  );
  res.json({ ok: true });
});

// Withdraw my report (removed from the map; stays in the database so existing chats keep their context)
router.delete("/:id", requireRole("user"), (req, res) => {
  const r = ownReport(req, res);
  if (!r) return;
  if (r.status === "hidden") return res.status(403).json({ error: "This report was hidden by a moderator" });
  db.prepare("UPDATE reports SET status='withdrawn', updated_at=? WHERE id=?").run(new Date().toISOString(), r.id);
  res.json({ ok: true });
});

module.exports = router;
