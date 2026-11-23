const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");

const db = require("../db");
const { ID_DIR } = require("../config");
const { encrypt, encryptBuffer, blindIndex } = require("../crypto");
const { logAdmin } = require("../audit");
const { clientIp } = require("../ip");
const { COOKIE, investigatorInfo } = require("../middleware/auth");
const v = require("../validate");

const router = express.Router();

// Max 20 login/register attempts per 15 minutes per visitor (kept in memory only)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

// ---------- helpers ----------
async function startSession(res, user) {
  const hours = user.role === "admin" ? 2 : 8; // admins get shorter sessions
  const sid = crypto.randomUUID();
  const now = Date.now();
  await db.run("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
    sid,
    user.id,
    new Date(now).toISOString(),
    new Date(now + hours * 3600 * 1000).toISOString(),
  ]);
  const token = jwt.sign({ sid }, process.env.JWT_SECRET, { expiresIn: `${hours}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true, // JavaScript in the page cannot read this cookie
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: hours * 3600 * 1000,
    path: "/",
  });
}

async function publicUser(u) {
  const out = { id: u.id, username: u.username, email: u.email, role: u.role };
  if (u.role === "investigator") out.investigator = await investigatorInfo(u.id);
  return out;
}

function dbError(e, res) {
  // 23505 = PostgreSQL "unique violation"; e.constraint says which rule was broken
  if (e.code === "23505") {
    if (e.constraint === "users_nid_hash_key") return res.status(409).json({ error: "An account with this NID already exists" });
    if (e.constraint === "users_email_key") return res.status(409).json({ error: "That email is already registered" });
  }
  console.error(e);
  return res.status(500).json({ error: "Server error" });
}

// Check the first bytes of the file so a renamed .exe can't be uploaded as "ID card"
function detectType(buf) {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 4 && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image/png";
  if (buf.length > 4 && buf.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  return null;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
function uploadIdCard(req, res, next) {
  upload.single("idCard")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "ID card file must be under 5 MB" : "File upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

// ---------- register: regular user / crime reporter ----------
router.post("/register", authLimiter, async (req, res) => {
  const problem = v.validateAccount(req.body);
  if (problem) return res.status(400).json({ error: problem });
  try {
    const nid = v.cleanNid(req.body.nid);
    const hash = await bcrypt.hash(req.body.password, 12);
    const id = await db.insert(
      "INSERT INTO users (username, email, password_hash, role, nid_enc, nid_hash) VALUES (?, ?, ?, 'user', ?, ?)",
      [req.body.username.trim(), req.body.email.trim().toLowerCase(), hash, encrypt(nid), blindIndex(nid)]
    );
    const user = await db.get("SELECT * FROM users WHERE id = ?", [id]);
    await startSession(res, user);
    res.status(201).json({ user: await publicUser(user) });
  } catch (e) {
    dbError(e, res);
  }
});

// ---------- register: investigator (police / journalist) ----------
router.post("/register-investigator", authLimiter, uploadIdCard, async (req, res) => {
  const b = req.body;
  const problem = v.validateAccount(b);
  if (problem) return res.status(400).json({ error: problem });

  const fullName = v.text(b.fullName, 3, 100);
  const organization = v.text(b.organization, 2, 150);
  const jobTitle = v.text(b.jobTitle, 2, 100);
  const workIdNumber = v.text(b.workIdNumber || "", 0, 60) ?? "";
  const about = v.text(b.about || "", 0, 500) ?? "";
  if (!["police", "journalist"].includes(b.jobType)) return res.status(400).json({ error: "Choose Police or Journalist" });
  if (!fullName || !organization || !jobTitle) {
    return res.status(400).json({ error: "Full name, organization and job title are required" });
  }
  if (!req.file) return res.status(400).json({ error: "Please upload a photo or scan of your ID card" });
  const mime = detectType(req.file.buffer);
  if (!mime) return res.status(400).json({ error: "ID card must be a JPG, PNG or PDF file" });

  // Save the ID card ENCRYPTED on disk under a random name
  const fileName = crypto.randomBytes(24).toString("hex") + ".enc";
  const filePath = path.join(ID_DIR, fileName);
  fs.writeFileSync(filePath, encryptBuffer(req.file.buffer));

  try {
    const nid = v.cleanNid(b.nid);
    const hash = await bcrypt.hash(b.password, 12);
    const details = encrypt(JSON.stringify({ fullName, organization, jobTitle, workIdNumber, about }));

    const userId = await db.tx(async (t) => {
      const id = await t.insert(
        "INSERT INTO users (username, email, password_hash, role, nid_enc, nid_hash) VALUES (?, ?, ?, 'investigator', ?, ?)",
        [b.username.trim(), b.email.trim().toLowerCase(), hash, encrypt(nid), blindIndex(nid)]
      );
      await t.run("INSERT INTO investigator_profiles (user_id, job_type, details_enc, id_card_file, id_card_mime) VALUES (?, ?, ?, ?, ?)", [
        id,
        b.jobType,
        details,
        fileName,
        mime,
      ]);
      return id;
    });
    const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
    await startSession(res, user);
    res.status(201).json({ user: await publicUser(user) });
  } catch (e) {
    fs.rmSync(filePath, { force: true }); // registration failed: remove the saved file
    dbError(e, res);
  }
});

// ---------- login ----------
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

// Usernames are NOT unique (two people may pick the same one), so people log in with their EMAIL.
router.post("/login", authLimiter, async (req, res) => {
  const body = req.body || {};
  const email = body.email ?? body.identifier;
  const password = body.password;
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const u = await db.get("SELECT * FROM users WHERE lower(email) = ?", [email.trim().toLowerCase()]);
  // Always run a password check, even for unknown users, so response time doesn't reveal which accounts exist
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);

  if (!u || !ok) {
    if (u && u.role === "admin") {
      await logAdmin({ admin: u, action: "ADMIN_LOGIN_FAILED", message: `Failed login attempt for ${u.username}`, ip: clientIp(req) });
    }
    return res.status(401).json({ error: "Wrong email or password" });
  }
  if (!u.is_active) return res.status(403).json({ error: "This account has been disabled" });

  await startSession(res, u);
  if (u.role === "admin") {
    await logAdmin({ admin: u, action: "ADMIN_LOGIN", message: `${u.username} logged in`, ip: clientIp(req) });
  }
  res.json({ user: await publicUser(u) });
});

// ---------- logout ----------
router.post("/logout", async (req, res) => {
  if (req.user) {
    await db.run("UPDATE sessions SET ended_at = ? WHERE id = ?", [new Date().toISOString(), req.sessionId]);
    if (req.user.role === "admin") {
      await logAdmin({ admin: req.user, action: "ADMIN_LOGOUT", message: `${req.user.username} logged out`, ip: clientIp(req) });
    }
  }
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

// ---------- who am I ----------
router.get("/me", async (req, res) => {
  res.json({ user: req.user ? await publicUser(req.user) : null });
});

module.exports = router;
