// Creates (or updates) the SafeVoice tables in your Supabase database.  Safe to run again at any time.
//   node scripts/init-db.js        (or:  npm run db:setup)
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const db = require("../db");
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");
  await db.pool.query(sql);
  const t = await db.get("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'public'");
  console.log(`Database is ready (${t.n} tables in the public schema).`);
  await db.end();
}

main().catch((e) => {
  console.error("\nCould not set up the database:", e.message);
  if (/ENOTFOUND|ETIMEDOUT|ENETUNREACH|EAI_AGAIN/.test(String(e.message) + String(e.code))) {
    console.error("Cannot reach Supabase. If you used the \"Direct connection\" string, switch to the \"Session pooler\" string (it works on IPv4 networks).");
  }
  if (/password authentication failed/i.test(e.message)) {
    console.error("Wrong database password in DATABASE_URL. Reset it in Supabase > Project Settings > Database.");
  }
  process.exit(1);
});
