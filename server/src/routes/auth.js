import crypto from 'node:crypto';
import { Router } from 'express';
import { HttpError, unauthorized } from '../errors.js';
import {
  burnPasswordWork,
  COOKIE_NAME,
  cookieOptions,
  createSession,
  destroySession,
  hashPassword,
  loadUser,
  purgeExpiredSessions,
  verifyPassword,
} from '../security.js';
import { createProject } from '../services/store.js';
import { parse, schemas } from '../validation.js';

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });

export const authRoutes = ({ db, config, limiters }) => {
  const router = Router();

  const startSession = (req, res, userId) => {
    destroySession(db, req.cookies?.[COOKIE_NAME]);
    const { token, expiresAt } = createSession(db, userId, config.sessionDays);
    res.cookie(COOKIE_NAME, token, cookieOptions(req, expiresAt));
  };

  router.post('/register', limiters.register, async (req, res) => {
    if (!config.allowRegistration) throw new HttpError(403, 'Registration is currently closed', 'registration_closed');
    const input = parse(schemas.register, req.body);

    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email);
    const passwordHash = await hashPassword(input.password);
    if (exists) throw new HttpError(409, 'We could not create that account. Try signing in instead.', 'account_unavailable');

    const user = { id: crypto.randomUUID(), email: input.email, name: input.name };
    try {
      db.transaction(() => {
        db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
          user.id,
          user.email,
          user.name,
          passwordHash,
          Date.now(),
        );
        createProject(db, config.limits, user.id, { name: 'Getting started', template: 'welcome' });
      })();
    } catch (error) {
      if (String(error?.code).startsWith('SQLITE_CONSTRAINT')) {
        throw new HttpError(409, 'We could not create that account. Try signing in instead.', 'account_unavailable');
      }
      throw error;
    }

    startSession(req, res, user.id);
    res.status(201).json({ user: publicUser(user) });
  });

  router.post('/login', limiters.login, async (req, res) => {
    const input = parse(schemas.login, req.body);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(input.email);

    if (!row) {
      await burnPasswordWork(input.password);
      throw unauthorized('Incorrect email or password');
    }
    if (!(await verifyPassword(input.password, row.password_hash))) throw unauthorized('Incorrect email or password');

    purgeExpiredSessions(db);
    startSession(req, res, row.id);
    res.json({ user: publicUser(row) });
  });

  router.post('/logout', (req, res) => {
    destroySession(db, req.cookies?.[COOKIE_NAME]);
    res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax', secure: req.secure });
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    const user = loadUser(db, req.cookies?.[COOKIE_NAME]);
    res.json({ user: user ? publicUser(user) : null });
  });

  return router;
};
