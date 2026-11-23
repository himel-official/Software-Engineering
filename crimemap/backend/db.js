// Database layer: Supabase = PostgreSQL. The backend connects directly with the "pg" driver using DATABASE_URL (see backend/.env).
// Everything is async now, so every call needs "await":
//   await db.get(sql, [params])     -> first row, or undefined
//   await db.all(sql, [params])     -> array of rows
//   await db.run(sql, [params])     -> number of rows changed
//   await db.insert(sql, [params])  -> id of the new row (adds RETURNING id for you)
//   await db.tx(async (t) => { ... t.get / t.all / t.run / t.insert ... })   -> all-or-nothing transaction
// SQL is written with "?" placeholders; they are converted to $1, $2, ... here.
const { Pool, types } = require("pg");

// COUNT(*) and other 64-bit numbers come back as text by default: make them normal JS numbers.
types.setTypeParser(20, (v) => parseInt(v, 10));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing in backend/.env.\n" +
      "Copy the connection string from Supabase (Connect > Session pooler) and add a line:  DATABASE_URL=postgresql://..."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires an encrypted connection. Set DATABASE_SSL=false only for a Postgres on your own computer.
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: Number(process.env.DATABASE_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});
// An idle connection dropped by the server must not crash the whole site.
pool.on("error", (e) => console.error("Database connection error:", e.message));

const toPg = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

function api(q) {
  return {
    async all(sql, params = []) {
      return (await q.query(toPg(sql), params)).rows;
    },
    async get(sql, params = []) {
      return (await q.query(toPg(sql), params)).rows[0];
    },
    async run(sql, params = []) {
      return (await q.query(toPg(sql), params)).rowCount;
    },
    async insert(sql, params = []) {
      const r = await q.query(toPg(sql) + " RETURNING id", params);
      return r.rows[0].id;
    },
  };
}

const db = api(pool);

db.tx = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(api(client));
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* connection already gone */ }
    throw e;
  } finally {
    client.release();
  }
};

db.end = () => pool.end();
db.pool = pool;

module.exports = db;
