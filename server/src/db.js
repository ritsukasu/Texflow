import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  main_file  TEXT NOT NULL DEFAULT 'main.tex',
  engine     TEXT NOT NULL DEFAULT 'pdflatex' CHECK (engine IN ('pdflatex', 'xelatex', 'lualatex')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS files (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  content    BLOB NOT NULL,
  is_text    INTEGER NOT NULL CHECK (is_text IN (0, 1)),
  size       INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, path)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS builds (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  ok         INTEGER NOT NULL,
  pdf        BLOB,
  log        TEXT NOT NULL,
  diagnostics TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  built_at   INTEGER NOT NULL
);
`;

export const openDatabase = (dataDir) => {
  const inMemory = dataDir === ':memory:';
  if (!inMemory) fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  const db = new Database(inMemory ? ':memory:' : path.join(dataDir, 'texflow.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
};

export const projectBytes = (db, projectId) =>
  db.prepare('SELECT COALESCE(SUM(size), 0) AS total FROM files WHERE project_id = ?').get(projectId).total;
