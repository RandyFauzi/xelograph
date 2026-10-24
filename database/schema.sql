PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS alumni (
 id TEXT PRIMARY KEY,
 full_name TEXT NOT NULL,
 nickname TEXT NOT NULL,
 whatsapp TEXT NOT NULL UNIQUE,
 avatar_json TEXT NOT NULL CHECK(json_valid(avatar_json)),
 consent_public INTEGER NOT NULL DEFAULT 0 CHECK(consent_public IN (0,1)),
 consent_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS invitations (
 code_hash TEXT PRIMARY KEY,
 label TEXT NOT NULL,
 alumni_id TEXT REFERENCES alumni(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 alumni_id TEXT NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS responses (
 alumni_id TEXT PRIMARY KEY REFERENCES alumni(id) ON DELETE CASCADE,
 answers_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(answers_json)),
 completed_at TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS checkpoint_progress (
 alumni_id TEXT NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
 checkpoint INTEGER NOT NULL CHECK(checkpoint BETWEEN 0 AND 6),
 completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(alumni_id, checkpoint)
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS alumni_public_idx ON alumni(consent_public);
CREATE INDEX IF NOT EXISTS responses_completed_idx ON responses(completed_at);
