import { z } from 'zod';
import { HttpError } from './errors.js';

export const TEXT_EXTENSIONS = new Set(['tex', 'bib', 'sty', 'cls', 'bst', 'bbx', 'cbx', 'def', 'cfg', 'txt', 'csv', 'dat']);
export const BINARY_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'pdf', 'eps']);

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_PATH_LENGTH = 120;
const MAX_DEPTH = 4;

export const extensionOf = (filePath) => {
  const dot = filePath.lastIndexOf('.');
  return dot === -1 ? '' : filePath.slice(dot + 1).toLowerCase();
};

export const isTextPath = (filePath) => TEXT_EXTENSIONS.has(extensionOf(filePath));

export const MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
  eps: 'application/postscript',
};

export const normalizePath = (input) => {
  if (typeof input !== 'string') throw new HttpError(422, 'Enter a valid file name');
  const value = input.trim();
  if (!value || value.length > MAX_PATH_LENGTH) throw new HttpError(422, 'File names must be 1 to 120 characters');
  const segments = value.split('/');
  if (segments.length > MAX_DEPTH) throw new HttpError(422, 'Folders can be nested at most three levels deep');
  for (const segment of segments) {
    if (!SEGMENT.test(segment) || segment.includes('..')) {
      throw new HttpError(422, 'Use letters, numbers, dots, dashes and underscores only');
    }
  }
  const ext = extensionOf(value);
  if (!TEXT_EXTENSIONS.has(ext) && !BINARY_EXTENSIONS.has(ext)) {
    throw new HttpError(422, `Files of type .${ext || 'none'} are not supported`);
  }
  return value;
};

export const normalizeTexPath = (input) => {
  const value = normalizePath(input);
  if (extensionOf(value) !== 'tex') throw new HttpError(422, 'The main file must be a .tex file');
  return value;
};

const MAGIC = {
  png: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  pdf: (b) => b.length > 5 && b.subarray(0, 1024).includes('%PDF-'),
  eps: (b) => b.length > 4 && (b.subarray(0, 4).toString('latin1') === '%!PS' || (b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6)),
};

export const looksLikeBinaryType = (filePath, buffer) => MAGIC[extensionOf(filePath)]?.(buffer) ?? false;

const trimmed = (max, label) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const schemas = {
  register: z.object({
    name: trimmed(80, 'Name'),
    email: z
      .string({ error: 'Email is required' })
      .trim()
      .toLowerCase()
      .max(254, 'Email is too long')
      .pipe(z.email('Enter a valid email address')),
    password: z
      .string({ error: 'Password is required' })
      .min(10, 'Use at least 10 characters')
      .max(128, 'Use 128 characters or fewer'),
  }),
  login: z.object({
    email: z.string({ error: 'Email is required' }).trim().toLowerCase().max(254),
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(128),
  }),
  projectCreate: z.object({
    name: trimmed(100, 'Project name'),
    template: z.enum(['welcome', 'article', 'report', 'beamer', 'blank']).default('article'),
  }),
  projectPatch: z
    .object({
      name: trimmed(100, 'Project name').optional(),
      mainFile: z.string().optional(),
      engine: z.enum(['pdflatex', 'xelatex', 'lualatex']).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, 'Nothing to update'),
  filePut: z.object({
    path: z.string(),
    content: z.string().max(4 * 1024 * 1024, 'File is too large'),
  }),
  fileRename: z.object({ from: z.string(), to: z.string() }),
};

export const parse = (schema, data) => {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    fields[key] ??= issue.message;
  }
  const error = new HttpError(422, Object.values(fields)[0] ?? 'Please check your input', 'invalid');
  error.fields = fields;
  throw error;
};
