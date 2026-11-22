import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const toInt = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid numeric configuration value: ${value}`);
  }
  return parsed;
};

const toBool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const env = process.env;
const nodeEnv = env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';

export const config = Object.freeze({
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  host: env.HOST || '0.0.0.0',
  port: toInt(env.PORT, 3001, { min: 0, max: 65535 }),
  dataDir: path.resolve(env.DATA_DIR || path.join(here, '..', 'data')),
  clientDir: path.resolve(env.CLIENT_DIR || path.join(here, '..', '..', 'client', 'dist')),
  trustProxy: toInt(env.TRUST_PROXY, 0, { min: 0, max: 10 }),
  allowRegistration: toBool(env.ALLOW_REGISTRATION, true),
  sessionDays: toInt(env.SESSION_DAYS, 30, { min: 1, max: 365 }),
  limits: Object.freeze({
    projectsPerUser: toInt(env.MAX_PROJECTS_PER_USER, 40, { min: 1 }),
    filesPerProject: toInt(env.MAX_FILES_PER_PROJECT, 80, { min: 1 }),
    textFileBytes: toInt(env.MAX_TEXT_FILE_BYTES, 1024 * 1024, { min: 1024 }),
    uploadBytes: toInt(env.MAX_UPLOAD_BYTES, 8 * 1024 * 1024, { min: 1024 }),
    projectBytes: toInt(env.MAX_PROJECT_BYTES, 32 * 1024 * 1024, { min: 1024 }),
  }),
  compile: Object.freeze({
    timeoutMs: toInt(env.COMPILE_TIMEOUT_MS, 45_000, { min: 1000, max: 600_000 }),
    concurrency: toInt(env.COMPILE_CONCURRENCY, 2, { min: 1, max: 32 }),
    queueLimit: toInt(env.COMPILE_QUEUE_LIMIT, 12, { min: 0, max: 500 }),
    maxPdfBytes: toInt(env.COMPILE_MAX_PDF_BYTES, 40 * 1024 * 1024, { min: 1024 }),
    maxLogBytes: 400 * 1024,
    allowLuaLatex: toBool(env.ALLOW_LUALATEX, false),
  }),
});
