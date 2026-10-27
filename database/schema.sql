PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS alumni (
 id TEXT PRIMARY KEY,
 full_name TEXT NOT NULL,
 nickname TEXT NOT NULL,
 whatsapp TEXT NOT NULL UNIQUE,
 avatar_json TEXT NOT NULL CHECK(json_valid(avatar_json)),
 avatar_revision INTEGER NOT NULL DEFAULT 1 CHECK(avatar_revision > 0),
 avatar_updated_at TEXT,
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
 completion_basis TEXT NOT NULL DEFAULT 'game',
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

CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,
 credential_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS survey_imports (
 id TEXT PRIMARY KEY,
 source_hash TEXT NOT NULL UNIQUE,
 source_name TEXT NOT NULL,
 summary_json TEXT NOT NULL CHECK(json_valid(summary_json)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS legacy_responses (
 id TEXT PRIMARY KEY,
 import_id TEXT NOT NULL REFERENCES survey_imports(id),
 source_key TEXT NOT NULL UNIQUE,
 sheet_name TEXT NOT NULL,
 row_number INTEGER NOT NULL,
 full_name TEXT NOT NULL,
 nickname TEXT NOT NULL,
 whatsapp TEXT,
 submitted_at TEXT,
 answers_json TEXT NOT NULL CHECK(json_valid(answers_json)),
 raw_json TEXT NOT NULL CHECK(json_valid(raw_json)),
 notes_json TEXT NOT NULL CHECK(json_valid(notes_json)),
 avatar_json TEXT NOT NULL CHECK(json_valid(avatar_json)),
 published_by_admin INTEGER NOT NULL DEFAULT 0 CHECK(published_by_admin IN (0,1)),
 linked_alumni_id TEXT REFERENCES alumni(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS legacy_phone_idx ON legacy_responses(whatsapp);

CREATE TABLE IF NOT EXISTS chat_messages (
 id TEXT PRIMARY KEY,
 alumni_id TEXT REFERENCES alumni(id) ON DELETE SET NULL,
 visitor_id TEXT,
 nickname TEXT NOT NULL,
 text TEXT NOT NULL,
 is_system INTEGER NOT NULL DEFAULT 0 CHECK(is_system IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_created_idx ON chat_messages(created_ms);
