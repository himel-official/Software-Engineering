// SQLite database built into Node.js (needs Node 22.5+). Nothing extra to install.
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const dataDir = process.env.DB_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "crimemap.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('user','investigator','admin')),
    nid_enc       TEXT,           -- NID encrypted (AES-256-GCM): only admins can decrypt it through the admin portal
    nid_hash      TEXT UNIQUE,    -- keyed hash of the NID: lets us enforce "one NID = one account" without reading it
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE IF NOT EXISTS investigator_profiles (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id),
    job_type       TEXT NOT NULL CHECK (job_type IN ('police','journalist')),
    details_enc    TEXT NOT NULL,  -- full name, organization, job title, work ID number (encrypted JSON)
    id_card_file   TEXT NOT NULL,  -- encrypted file on disk
    id_card_mime   TEXT NOT NULL,
    bio            TEXT NOT NULL DEFAULT '',  -- public profile text written by the investigator
    status         TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','verified')),
    verified_by    INTEGER REFERENCES users(id),
    verified_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ended_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL,
    description TEXT NOT NULL,
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    occurred_at TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn','hidden')),
    created_at  TEXT NOT NULL DEFAULT ${NOW},
    updated_at  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

  CREATE TABLE IF NOT EXISTS chat_threads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id       INTEGER NOT NULL REFERENCES reports(id),
    investigator_id INTEGER NOT NULL REFERENCES users(id),
    reporter_id     INTEGER NOT NULL REFERENCES users(id),
    created_at      TEXT NOT NULL DEFAULT ${NOW},
    UNIQUE (report_id, investigator_id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id  INTEGER NOT NULL REFERENCES chat_threads(id),
    sender_id  INTEGER NOT NULL REFERENCES users(id),
    body_enc   TEXT NOT NULL,      -- message encrypted at rest
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON chat_messages(thread_id, id);

  -- Remembers, per person and chat, the last message they have read (used for unread counters).
  CREATE TABLE IF NOT EXISTS chat_reads (
    thread_id    INTEGER NOT NULL REFERENCES chat_threads(id),
    user_id      INTEGER NOT NULL REFERENCES users(id),
    last_read_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (thread_id, user_id)
  );

  -- Admin audit log. Each row is chained to the previous one by a hash (tamper-evident).
  CREATE TABLE IF NOT EXISTS audit_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ts              TEXT NOT NULL,
    admin_id        INTEGER NOT NULL,
    admin_username  TEXT NOT NULL,
    action          TEXT NOT NULL,
    target_type     TEXT,
    target_id       INTEGER,
    target_username TEXT,
    message         TEXT NOT NULL,
    ip              TEXT,
    prev_hash       TEXT NOT NULL,
    hash            TEXT NOT NULL
  );

  -- PERMANENT: the database itself refuses to change or delete these rows.
  CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_logs
    BEGIN SELECT RAISE(ABORT, 'audit logs are permanent and cannot be modified'); END;
  CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_logs
    BEGIN SELECT RAISE(ABORT, 'audit logs are permanent and cannot be deleted'); END;
  CREATE TRIGGER IF NOT EXISTS chat_no_update BEFORE UPDATE ON chat_messages
    BEGIN SELECT RAISE(ABORT, 'chat messages are permanent and cannot be modified'); END;
  CREATE TRIGGER IF NOT EXISTS chat_no_delete BEFORE DELETE ON chat_messages
    BEGIN SELECT RAISE(ABORT, 'chat messages are permanent and cannot be deleted'); END;
`);

// ---------- upgrade older databases ----------
const invCols = db.prepare("PRAGMA table_info(investigator_profiles)").all().map((c) => c.name);
if (!invCols.includes("bio")) {
  db.exec("ALTER TABLE investigator_profiles ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
}

module.exports = db;
