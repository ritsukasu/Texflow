import { createApp } from './app.js';
import { config } from './config.js';
import { openDatabase } from './db.js';
import { purgeExpiredSessions } from './security.js';
import { Compiler } from './services/compiler.js';

const db = openDatabase(config.dataDir);
const compiler = new Compiler(config.compile, config.dataDir);
const app = createApp({ config, db, compiler });

purgeExpiredSessions(db);
const sweep = setInterval(() => purgeExpiredSessions(db), 6 * 60 * 60 * 1000);
sweep.unref();

const server = app.listen(config.port, config.host, () => {
  process.stdout.write(`${JSON.stringify({ t: new Date().toISOString(), level: 'info', message: `Texflow listening on ${config.host}:${config.port}` })}\n`);
});

let closing = false;
const shutdown = (signal) => {
  if (closing) return;
  closing = true;
  process.stdout.write(`${JSON.stringify({ t: new Date().toISOString(), level: 'info', message: `${signal} received, shutting down` })}\n`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`${JSON.stringify({ t: new Date().toISOString(), level: 'error', message: String(reason?.message ?? reason) })}\n`);
});
