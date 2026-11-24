// Creates backend/.env with fresh random secret keys (only if it does not exist yet).
// Uses only built-in Node modules, so it can run before "npm install".
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  console.log(".env already exists - keeping your existing keys.");
  // Older .env files (from before Supabase) have no DATABASE_URL line yet: add an empty one to fill in.
  const current = fs.readFileSync(envPath, "utf8");
  if (!/^DATABASE_URL=/m.test(current)) {
    const nl = current.endsWith("\n") ? "" : "\n";
    fs.appendFileSync(envPath, nl + "# Supabase: Connect > Session pooler > URI (replace [YOUR-PASSWORD] with your database password)\nDATABASE_URL=\n");
    console.log("Added an empty DATABASE_URL line to backend/.env - fill it in with your Supabase connection string.");
  }
  // Same for the Supabase Storage lines (files).
  const after = fs.readFileSync(envPath, "utf8");
  const add = [];
  if (!/^SUPABASE_URL=/m.test(after)) add.push("SUPABASE_URL=");
  if (!/^SUPABASE_SERVICE_KEY=/m.test(after)) add.push("SUPABASE_SERVICE_KEY=");
  if (add.length) {
    const nl2 = after.endsWith("\n") ? "" : "\n";
    fs.appendFileSync(envPath, nl2 + "# Supabase Storage (files): Project Settings > API: Project URL and the SECRET key (service_role / sb_secret_...)\n" + add.join("\n") + "\n");
    console.log("Added " + add.join(" and ") + " to backend/.env - fill them in (Supabase > Project Settings > API).");
  }
  process.exit(0);
}

const key = () => crypto.randomBytes(32).toString("hex");
const content = [
  "PORT=5000",
  "NODE_ENV=development",
  `JWT_SECRET=${key()}`,
  `ENCRYPTION_KEY=${key()}`,
  `NID_HMAC_KEY=${key()}`,
  "# Supabase: Connect > Session pooler > URI (replace [YOUR-PASSWORD] with your database password)",
  "DATABASE_URL=",
  "# Supabase Storage (files): Project Settings > API: Project URL and the SECRET key (service_role / sb_secret_...)",
  "SUPABASE_URL=",
  "SUPABASE_SERVICE_KEY=",
  "",
].join("\n");

fs.writeFileSync(envPath, content);
console.log("Created backend/.env with new random secret keys.");
console.log("IMPORTANT: back this file up. If ENCRYPTION_KEY is lost, stored NIDs and ID cards can never be read again.");
