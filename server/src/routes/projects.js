import express, { Router } from 'express';
import { zipSync, strToU8 } from 'fflate';
import { badRequest, HttpError, notFound } from '../errors.js';
import { requireAuth } from '../security.js';
import { availableEngines } from '../services/compiler.js';
import {
  createProject,
  deleteFile,
  duplicateProject,
  getBuild,
  getFileRow,
  getOwnedProject,
  isUuid,
  listFilesWithContent,
  listProjects,
  renameFile,
  saveBuild,
  saveFile,
  serializeBuild,
  serializeFileMeta,
  serializeProject,
} from '../services/store.js';
import {
  extensionOf,
  isTextPath,
  looksLikeBinaryType,
  MIME_TYPES,
  normalizePath,
  normalizeTexPath,
  parse,
  schemas,
} from '../validation.js';

const safeFilename = (name) => name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project';

export const projectRoutes = ({ db, config, compiler, limiters }) => {
  const router = Router();
  router.use(requireAuth(db));

  router.param('id', (_req, _res, next, id) => {
    if (!isUuid(id)) return next(notFound('Project not found'));
    next();
  });

  const owned = (req) => getOwnedProject(db, req.user.id, req.params.id);

  router.get('/', (req, res) => {
    res.json({ projects: listProjects(db, req.user.id) });
  });

  router.post('/', (req, res) => {
    const input = parse(schemas.projectCreate, req.body);
    const project = createProject(db, config.limits, req.user.id, input);
    res.status(201).json({ project: serializeProject(project) });
  });

  router.get('/:id', (req, res) => {
    const project = owned(req);
    const build = getBuild(db, project.id);
    res.json({
      project: serializeProject(project),
      files: listFilesWithContent(db, project.id),
      build: build ? serializeBuild(build) : null,
      engines: availableEngines(config.compile),
    });
  });

  router.patch('/:id', (req, res) => {
    const project = owned(req);
    const input = parse(schemas.projectPatch, req.body);

    const next = {
      name: input.name ?? project.name,
      main_file: project.main_file,
      engine: input.engine ?? project.engine,
    };

    if (input.engine && !availableEngines(config.compile).includes(input.engine)) {
      throw new HttpError(422, 'That engine is not enabled on this server');
    }
    if (input.mainFile !== undefined) {
      next.main_file = normalizeTexPath(input.mainFile);
      if (!getFileRow(db, project.id, next.main_file)) throw notFound('File not found');
    }

    db.prepare('UPDATE projects SET name = ?, main_file = ?, engine = ?, updated_at = ? WHERE id = ?').run(
      next.name,
      next.main_file,
      next.engine,
      Date.now(),
      project.id,
    );
    res.json({ project: serializeProject(getOwnedProject(db, req.user.id, project.id)) });
  });

  router.delete('/:id', (req, res) => {
    const project = owned(req);
    db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    res.status(204).end();
  });

  router.post('/:id/duplicate', (req, res) => {
    const project = owned(req);
    const copy = duplicateProject(db, config.limits, req.user.id, project);
    res.status(201).json({ project: serializeProject(copy) });
  });

  router.put('/:id/file', (req, res) => {
    const project = owned(req);
    const input = parse(schemas.filePut, req.body);
    const filePath = normalizePath(input.path);
    if (!isTextPath(filePath)) throw new HttpError(415, 'Only text files can be edited here');
    if (input.content.includes('\0')) throw badRequest('Text files cannot contain null characters');
    const file = saveFile(db, config.limits, project.id, filePath, Buffer.from(input.content, 'utf8'), {
      maxBytes: config.limits.textFileBytes,
    });
    res.json({ file });
  });

  router.post(
    '/:id/upload',
    express.raw({ type: () => true, limit: config.limits.uploadBytes }),
    (req, res) => {
      const project = owned(req);
      const filePath = normalizePath(req.query.path);
      if (isTextPath(filePath)) throw new HttpError(415, 'Create text files from the sidebar instead');
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (body.length === 0) throw badRequest('The file is empty');
      if (!looksLikeBinaryType(filePath, body)) throw new HttpError(415, `That file does not look like a valid .${extensionOf(filePath)}`);
      const file = saveFile(db, config.limits, project.id, filePath, body, { maxBytes: config.limits.uploadBytes });
      res.status(201).json({ file });
    },
  );

  router.post('/:id/file/rename', (req, res) => {
    const project = owned(req);
    const input = parse(schemas.fileRename, req.body);
    const from = normalizePath(input.from);
    const to = normalizePath(input.to);
    if (isTextPath(from) !== isTextPath(to)) throw new HttpError(422, 'A file cannot change between text and binary types');
    renameFile(db, project, from, to);
    res.json({ file: serializeFileMeta(getFileRow(db, project.id, to)) });
  });

  router.delete('/:id/file', (req, res) => {
    const project = owned(req);
    deleteFile(db, project, normalizePath(req.query.path));
    res.status(204).end();
  });

  router.get('/:id/raw', (req, res) => {
    const project = owned(req);
    const filePath = normalizePath(req.query.path);
    const row = getFileRow(db, project.id, filePath);
    if (!row) throw notFound('File not found');
    res.set({
      'Content-Type': MIME_TYPES[extensionOf(filePath)] ?? 'text/plain; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'Cache-Control': 'private, no-store',
    });
    res.send(row.content);
  });

  router.post('/:id/compile', limiters.compile, async (req, res) => {
    const project = owned(req);
    if (!getFileRow(db, project.id, project.main_file)) throw new HttpError(422, 'The main file is missing. Choose a main file first.');

    const files = db.prepare('SELECT path, content FROM files WHERE project_id = ?').all(project.id);
    const engine = availableEngines(config.compile).includes(project.engine) ? project.engine : 'pdflatex';
    const result = await compiler.compile({ projectId: project.id, files, mainFile: project.main_file, engine });

    const builtAt = saveBuild(db, project.id, result);
    res.json({
      build: {
        ok: result.ok,
        builtAt,
        durationMs: result.durationMs,
        hasPdf: getBuild(db, project.id).pdf !== null,
        diagnostics: result.diagnostics,
        log: result.log,
      },
    });
  });

  router.get('/:id/build', (req, res) => {
    const project = owned(req);
    const build = getBuild(db, project.id);
    res.json({ build: build ? serializeBuild(build) : null });
  });

  router.get('/:id/pdf', (req, res) => {
    const project = owned(req);
    const build = getBuild(db, project.id);
    if (!build?.pdf) throw notFound('No PDF has been built yet');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename="${safeFilename(project.name)}.pdf"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(build.pdf);
  });

  router.get('/:id/source.zip', (req, res) => {
    const project = owned(req);
    const entries = {};
    for (const row of db.prepare('SELECT path, content FROM files WHERE project_id = ?').all(project.id)) {
      entries[row.path] = new Uint8Array(row.content);
    }
    entries['README.txt'] = strToU8(`Exported from Texflow.\nMain file: ${project.main_file}\nEngine: ${project.engine}\n`);
    const archive = zipSync(entries, { level: 6 });
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeFilename(project.name)}-source.zip"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(Buffer.from(archive));
  });

  return router;
};
