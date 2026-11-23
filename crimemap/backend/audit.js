// Permanent admin audit log with a hash chain.
// Every entry stores the hash of the previous entry, so changing or removing an old
// entry would break the chain and be detected by verifyChain().
const crypto = require("crypto");
const db = require("./db");

function computeHash(prevHash, r) {
  const parts = [r.ts, r.admin_id, r.admin_username, r.action, r.target_type ?? "", r.target_id ?? "", r.target_username ?? "", r.message, r.ip ?? ""];
  return crypto.createHash("sha256").update(prevHash + "|" + parts.join("|")).digest("hex");
}

// admin: {id, username}   target (optional): {type, id, username}
async function logAdmin({ admin, action, target, message, ip }) {
  await db.tx(async (t) => {
    // Only one entry at a time may extend the chain (replaces SQLite's "BEGIN IMMEDIATE")
    await t.get("SELECT pg_advisory_xact_lock(727001)");
    const last = await t.get("SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1");
    const prevHash = last ? last.hash : "GENESIS";
    const row = {
      ts: new Date().toISOString(),
      admin_id: admin.id,
      admin_username: admin.username,
      action,
      target_type: target ? target.type : null,
      target_id: target ? target.id : null,
      target_username: target ? target.username : null,
      message,
      ip: ip || null,
    };
    const hash = computeHash(prevHash, row);
    await t.run(
      `INSERT INTO audit_logs (ts, admin_id, admin_username, action, target_type, target_id, target_username, message, ip, prev_hash, hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [row.ts, row.admin_id, row.admin_username, row.action, row.target_type, row.target_id, row.target_username, row.message, row.ip, prevHash, hash]
    );
  });
}

async function verifyChain() {
  const rows = await db.all("SELECT * FROM audit_logs ORDER BY id ASC");
  let prev = "GENESIS";
  for (const r of rows) {
    if (r.prev_hash !== prev || computeHash(prev, r) !== r.hash) {
      return { ok: false, count: rows.length, brokenAtId: r.id };
    }
    prev = r.hash;
  }
  return { ok: true, count: rows.length, brokenAtId: null };
}

module.exports = { logAdmin, verifyChain };
