const express = require("express");
const db = require("../db");
const { requireLogin, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireLogin); // profiles are visible to logged-in people only

// An investigator edits the public text on their own profile
router.put("/me", requireRole("investigator"), (req, res) => {
  const bio = String((req.body && req.body.bio) || "").trim();
  if (bio.length > 500) return res.status(400).json({ error: "Bio can be at most 500 characters" });
  db.prepare("UPDATE investigator_profiles SET bio = ? WHERE user_id = ?").run(bio, req.user.id);
  res.json({ ok: true });
});

// Public investigator profile. Private details (real name, organization, NID, ID card) are NEVER included.
router.get("/:username", (req, res) => {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.created_at, ip.job_type, ip.status, ip.verified_at, ip.bio
       FROM users u JOIN investigator_profiles ip ON ip.user_id = u.id
       WHERE u.username = ? AND u.role = 'investigator'`
    )
    .get(String(req.params.username));
  if (!row) return res.status(404).json({ error: "Investigator not found" });

  const conversations = db.prepare("SELECT COUNT(*) AS n FROM chat_threads WHERE investigator_id = ?").get(row.id).n;
  res.json({
    profile: {
      username: row.username,
      jobType: row.job_type,
      status: row.status,
      verifiedAt: row.status === "verified" ? row.verified_at : null,
      memberSince: row.created_at,
      bio: row.bio,
      conversations,
    },
  });
});

module.exports = router;
