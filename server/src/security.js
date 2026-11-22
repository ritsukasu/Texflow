import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError, unauthorized } from './errors.js';

const scrypt = promisify(crypto.scrypt);

const KEY_LEN = 64;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LEN, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
};

export const verifyPassword = async (password, stored) => {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const derived = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, SCRYPT);
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
};

let decoyHash;
export const burnPasswordWork = async (password) => {
  decoyHash ??= await hashPassword(crypto.randomBytes(12).toString('hex'));
  await verifyPassword(password, decoyHash);
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const COOKIE_NAME = 'tf_session';

export const createSession = (db, userId, days) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + days * 86_400_000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    userId,
    now,
    expiresAt,
  );
  return { token, expiresAt };
};

export const destroySession = (db, token) => {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
};

export const purgeExpiredSessions = (db) => {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
};

export const cookieOptions = (req, expiresAt) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: req.secure,
  path: '/',
  expires: new Date(expiresAt),
});

export const loadUser = (db, token) => {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  return (
    db
      .prepare(
        `SELECT u.id, u.email, u.name
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(sha256(token), Date.now()) ?? null
  );
};

export const requireAuth = (db) => (req, _res, next) => {
  const user = loadUser(db, req.cookies?.[COOKIE_NAME]);
  if (!user) return next(unauthorized());
  req.user = user;
  next();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfGuard = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get('x-requested-with') !== 'texflow') {
    return next(new HttpError(403, 'Request blocked', 'csrf'));
  }
  const origin = req.get('origin');
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      return next(new HttpError(403, 'Request blocked', 'csrf'));
    }
    if (originHost !== req.get('host')) return next(new HttpError(403, 'Request blocked', 'csrf'));
  }
  next();
};
