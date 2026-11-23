const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { requireRole } = require("../middleware/auth");
const { catchUp } = require("../notify");

const router = express.Router();
router.use(requireRole("user", "investigator"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => `loc-${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many location updates" },
});

// The website sends the device location here every couple of minutes while SafeVoice is open.
// Only the LATEST point is kept (no history). Admins can see it; every time they look it is written to the audit log.
router.post("/", limiter, async (req, res) => {
  const lat = Number(req.body && req.body.lat);
  const lng = Number(req.body && req.body.lng);
  const accuracy = Number(req.body && req.body.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: "Invalid location" });
  }
  await db.run(
    `INSERT INTO user_locations (user_id, lat, lng, accuracy, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy, updated_at = excluded.updated_at`,
    [req.user.id, lat, lng, Number.isFinite(accuracy) ? accuracy : null, new Date().toISOString()]
  );

  const newNotifications = await catchUp(req.user.id, lat, lng);
  res.json({ ok: true, newNotifications });
});

module.exports = router;
