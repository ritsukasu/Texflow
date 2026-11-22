import crypto from 'node:crypto';
import { projectBytes } from '../db.js';
import { conflict, notFound, tooLarge } from '../errors.js';
import { TEMPLATES } from '../templates.js';
import { isTextPath } from '../validation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isUuid = (value) => typeof value === 'string' && UUID.test(value);

export const serializeProject = (row) => ({
  id: row.id,
  name: row.name,
  mainFile: row.main_file,
  engine: row.engine,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.file_count === undefined ? {} : { fileCount: row.file_count }),
});

export const serializeFileMeta = (row) => ({
  path: row.path,
  size: row.size,
  isText: row.is_text === 1,
  updatedAt: row.updated_at,
});

export const getOwnedProject = (db, userId, projectId) => {
  if (!isUuid(projectId)) throw notFound('Project not found');
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  if (!row) throw notFound('Project not found');
  return row;
};

export const listProjects = (db, userId) =>
  db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM files f WHERE f.project_id = p.id) AS file_count
         FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`,
    )
    .all(userId)
    .map(serializeProject);

export const createProject = (db, limits, userId, { name, template }) => {
  const count = db.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?').get(userId).n;
  if (count >= limits.projectsPerUser) {
    throw conflict(`You can have up to ${limits.projectsPerUser} projects. Delete one to create another.`);
  }

  const spec = TEMPLATES[template] ?? TEMPLATES.article;
  const id = crypto.randomUUID();
  const now = Date.now();

  db.transaction(() => {
    db.prepare(
      'INSERT INTO projects (id, user_id, name, main_file, engine, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, userId, name, spec.mainFile, 'pdflatex', now, now);
    const insert = db.prepare(
      'INSERT INTO files (project_id, path, content, is_text, size, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const [filePath, content] of Object.entries(spec.files)) {
      const buffer = Buffer.from(content, 'utf8');
      insert.run(id, filePath, buffer, 1, buffer.length, now);
    }
  })();

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
};

export const duplicateProject = (db, limits, userId, source) => {
  const count = db.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?').get(userId).n;
  if (count >= limits.projectsPerUser) {
    throw conflict(`You can have up to ${limits.projectsPerUser} projects. Delete one to create another.`);
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  const name = `${source.name} copy`.slice(0, 100);

  db.transaction(() => {
    db.prepare(
      'INSERT INTO projects (id, user_id, name, main_file, engine, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, userId, name, source.main_file, source.engine, now, now);
    db.prepare(
      `INSERT INTO files (project_id, path, content, is_text, size, updated_at)
       SELECT ?, path, content, is_text, size, ? FROM files WHERE project_id = ?`,
    ).run(id, now, source.id);
  })();

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
};

export const touchProject = (db, projectId) => {
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(Date.now(), projectId);
};

export const listFilesWithContent = (db, projectId) =>
  db
    .prepare('SELECT path, content, is_text, size, updated_at FROM files WHERE project_id = ? ORDER BY path')
    .all(projectId)
    .map((row) => ({
      ...serializeFileMeta(row),
      ...(row.is_text === 1 ? { content: row.content.toString('utf8') } : {}),
    }));

export const getFileRow = (db, projectId, filePath) =>
  db.prepare('SELECT * FROM files WHERE project_id = ? AND path = ?').get(projectId, filePath);

export const saveFile = (db, limits, projectId, filePath, buffer, { maxBytes }) => {
  if (buffer.length > maxBytes) throw tooLarge(`That file is larger than ${Math.round(maxBytes / 1024 / 1024 * 10) / 10} MB`);

  const existing = getFileRow(db, projectId, filePath);
  if (!existing) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM files WHERE project_id = ?').get(projectId);
    if (n >= limits.filesPerProject) throw conflict(`A project can hold up to ${limits.filesPerProject} files`);
  }
  const delta = buffer.length - (existing?.size ?? 0);
  if (delta > 0 && projectBytes(db, projectId) + delta > limits.projectBytes) {
    throw tooLarge('This project has reached its storage limit');
  }

  const now = Date.now();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO files (project_id, path, content, is_text, size, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (project_id, path) DO UPDATE SET content = excluded.content, size = excluded.size, updated_at = excluded.updated_at`,
    ).run(projectId, filePath, buffer, isTextPath(filePath) ? 1 : 0, buffer.length, now);
    touchProject(db, projectId);
  })();

  return { path: filePath, size: buffer.length, isText: isTextPath(filePath), updatedAt: now };
};

export const renameFile = (db, project, from, to) => {
  if (!getFileRow(db, project.id, from)) throw notFound('File not found');
  if (getFileRow(db, project.id, to)) throw conflict('A file with that name already exists');
  db.transaction(() => {
    db.prepare('UPDATE files SET path = ?, updated_at = ? WHERE project_id = ? AND path = ?').run(to, Date.now(), project.id, from);
    if (project.main_file === from) db.prepare('UPDATE projects SET main_file = ? WHERE id = ?').run(to, project.id);
    touchProject(db, project.id);
  })();
};

export const deleteFile = (db, project, filePath) => {
  if (!getFileRow(db, project.id, filePath)) throw notFound('File not found');
  if (project.main_file === filePath) throw conflict('Choose a different main file before deleting this one');
  db.transaction(() => {
    db.prepare('DELETE FROM files WHERE project_id = ? AND path = ?').run(project.id, filePath);
    touchProject(db, project.id);
  })();
};

export const getBuild = (db, projectId) => db.prepare('SELECT * FROM builds WHERE project_id = ?').get(projectId);

export const serializeBuild = (row, { withLog = true } = {}) => ({
  ok: row.ok === 1,
  builtAt: row.built_at,
  durationMs: row.duration_ms,
  hasPdf: row.pdf !== null && row.pdf !== undefined,
  diagnostics: JSON.parse(row.diagnostics),
  ...(withLog ? { log: row.log } : {}),
});

export const saveBuild = (db, projectId, result) => {
  const builtAt = Date.now();
  db.prepare(
    `INSERT INTO builds (project_id, ok, pdf, log, diagnostics, duration_ms, built_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (project_id) DO UPDATE SET
       ok = excluded.ok,
       pdf = COALESCE(excluded.pdf, builds.pdf),
       log = excluded.log,
       diagnostics = excluded.diagnostics,
       duration_ms = excluded.duration_ms,
       built_at = excluded.built_at`,
  ).run(projectId, result.ok ? 1 : 0, result.pdf, result.log, JSON.stringify(result.diagnostics), result.durationMs, builtAt);
  return builtAt;
};
