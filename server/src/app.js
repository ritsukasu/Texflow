import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { HttpError, notFound } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { csrfGuard } from './security.js';
import { availableEngines } from './services/compiler.js';

const passthrough = (_req, _res, next) => next();

const buildLimiters = (config, enabled) => {
  if (!enabled) return { global: passthrough, login: passthrough, register: passthrough, compile: passthrough };

  const handler = (message) => (_req, res) =>
    res.status(429).json({ error: { code: 'rate_limited', message } });

  const base = { standardHeaders: 'draft-7', legacyHeaders: false };

  return {
    global: rateLimit({ ...base, windowMs: 60_000, limit: 600, handler: handler('Too many requests. Slow down for a moment.') }),
    login: rateLimit({
      ...base,
      windowMs: 15 * 60_000,
      limit: 8,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? '').toLowerCase().slice(0, 254)}`,
      handler: handler('Too many sign-in attempts. Try again in 15 minutes.'),
    }),
    register: rateLimit({
      ...base,
      windowMs: 60 * 60_000,
      limit: 12,
      handler: handler('Too many accounts created from this network. Try again later.'),
    }),
    compile: rateLimit({
      ...base,
      windowMs: 60_000,
      limit: 20,
      keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
      handler: handler('You are compiling very quickly. Wait a few seconds and try again.'),
    }),
  };
};

const contentSecurityPolicy = {
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    workerSrc: ["'self'", 'blob:'],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
};

const requestLogger = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    process.stdout.write(
      `${JSON.stringify({ t: new Date().toISOString(), m: req.method, p: req.path, s: res.statusCode, ms: Math.round(ms) })}\n`,
    );
  });
  next();
};

export const createApp = ({ config, db, compiler, rateLimits = true, logRequests = !config.isTest }) => {
  const app = express();
  const limiters = buildLimiters(config, rateLimits);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  if (logRequests) app.use(requestLogger);
  app.use(helmet({ contentSecurityPolicy, crossOriginResourcePolicy: { policy: 'same-origin' } }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  const api = express.Router();
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(limiters.global);
  api.use(csrfGuard);

  api.get('/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });
  api.get('/meta', (_req, res) => {
    res.json({ allowRegistration: config.allowRegistration, engines: availableEngines(config.compile) });
  });
  api.use('/auth', authRoutes({ db, config, limiters }));
  api.use('/projects', projectRoutes({ db, config, compiler, limiters }));
  api.use((_req, _res, next) => next(notFound('Endpoint not found')));
  app.use('/api', api);

  const indexFile = path.join(config.clientDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use(
      express.static(config.clientDir, {
        index: false,
        setHeaders: (res, filePath) => {
          res.setHeader(
            'Cache-Control',
            filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
          );
        },
      }),
    );
    app.get('/{*splat}', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexFile);
    });
  }

  app.use((req, _res, next) => next(notFound(req.path.startsWith('/api') ? 'Endpoint not found' : 'Page not found')));

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;

    if (error instanceof HttpError) {
      return res.status(error.status).json({
        error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
      });
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'too_large', message: 'That upload is too large' } });
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'bad_request', message: 'The request body is not valid JSON' } });
    }

    if (!config.isTest) process.stderr.write(`${JSON.stringify({ t: new Date().toISOString(), level: 'error', message: String(error?.message ?? error) })}\n`);
    res.status(500).json({ error: { code: 'internal', message: 'Something went wrong on our side. Please try again.' } });
  });

  return app;
};
