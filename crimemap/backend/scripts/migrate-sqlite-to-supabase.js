// One-time copy of your OLD local data (backend/data/crimemap.db) into Supabase.
// Only needed if you already have accounts / reports / chats you want to keep.
//   1. node scripts/init-db.js                       (creates the tables in Supabase)
//   2. node scripts/migrate-sqlite-to-supabase.js    (copies the data; needs Node 22.5+ to read the old file)
// Ids are kept, so reports, chats and the audit-log hash chain stay valid. Old login sessions are not copied (everyone logs in again).
// The files in backend/storage stay where they are and keep working. Keep using the SAME .env keys.
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const dbFile = path.join(__dirname, "..", "data", "crimemap.db");
  if (!fs.existsSync(dbFile)) throw new Error(`Old database not found: ${dbFile}`);
  const { DatabaseSync } = require("node:sqlite");
  const old = new DatabaseSync(dbFile, { readOnly: true });
  const db = require("../db");

  const already = await db.get("SELECT COUNT(*) AS n FROM users");
  if (already.n > 0 && !process.argv.includes("--force")) {
    throw new Error("Supabase already contains users. Refusing to copy twice (use --force only if you know what you are doing).");
  }

  // Parents before children (foreign keys).
  const tables = [
    "users", "investigator_profiles", "reports", "chat_threads", "chat_messages", "chat_files",
    "report_files", "user_locations", "notifications", "chat_reads", "audit_logs",
  ];
  const hasId = new Set(["users", "reports", "chat_threads", "chat_messages", "chat_files", "report_files", "notifications", "audit_logs"]);

  await db.tx(async (t) => {
    for (const table of tables) {
      const exists = old.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!exists) { console.log(`${table}: not in old database, skipped`); continue; }
      const rows = old.prepare(`SELECT * FROM ${table}`).all();
      for (const r of rows) {
        const cols = Object.keys(r);
        const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT DO NOTHING`;
        await t.run(sql, cols.map((c) => r[c]));
      }
      console.log(`${table}: ${rows.length} rows copied`);
    }
    // New rows must continue after the highest copied id.
    for (const table of hasId) {
      await t.get(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), (SELECT MAX(id) FROM ${table}) IS NOT NULL)`);
    }
  });
  console.log("\nDone. Your old data is now in Supabase (the old backend/data folder is untouched: keep it as a backup).");
  await db.end();
}

main().catch((e) => {
  console.error("\nMigration failed (nothing was copied):", e.message);
  process.exit(1);
});
