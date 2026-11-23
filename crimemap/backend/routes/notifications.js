const express = require("express");
const db = require("../db");
const { CRIME_TYPES } = require("../config");
const { round3 } = require("../geo");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("user", "investigator"));

const typeLabel = (key) => (CRIME_TYPES.find((t) => t.key === key) || { label: key }).label;

// My alerts (newest first). Alerts about reports that were later withdrawn or hidden are not shown.
router.get("/", async (req, res) => {
  const rows = await db.all(
      `SELECT n.id, n.report_id, n.distance_km, n.created_at, n.read_at, r.type, r.lat, r.lng, r.occurred_at
       FROM notifications n JOIN reports r ON r.id = n.report_id
       WHERE n.user_id = ? AND r.status = 'active' ORDER BY n.id DESC LIMIT 50`,
    [req.user.id]
  );
  const unread = (
    await db.get(
      `SELECT COUNT(*) AS n FROM notifications n JOIN reports r ON r.id = n.report_id
       WHERE n.user_id = ? AND n.read_at IS NULL AND r.status = 'active'`,
      [req.user.id]
    )
  ).n;
  res.json({
    unread,
    notifications: rows.map((r) => ({
      id: r.id,
      reportId: r.report_id,
      type: r.type,
      typeLabel: typeLabel(r.type),
      distanceKm: Math.round(r.distance_km * 10) / 10,
      occurredAt: r.occurred_at,
      createdAt: r.created_at,
      read: !!r.read_at,
      lat: round3(r.lat),
      lng: round3(r.lng),
    })),
  });
});

// Mark alerts as read: body { ids: [1,2] } or { all: true }
router.post("/read", async (req, res) => {
  const now = new Date().toISOString();
  if (req.body && req.body.all) {
    await db.run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [now, req.user.id]);
  } else if (req.body && Array.isArray(req.body.ids)) {
    const sql = "UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL";
    for (const id of req.body.ids.slice(0, 100)) if (Number.isInteger(id) && Math.abs(id) < 2147483647) await db.run(sql, [now, id, req.user.id]);
  }
  res.json({ ok: true });
});

module.exports = router;
