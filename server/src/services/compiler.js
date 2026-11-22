import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HttpError } from '../errors.js';

const ENGINE_FLAGS = {
  pdflatex: '-pdf',
  xelatex: '-xelatex',
  lualatex: '-lualatex',
};

const PRLIMIT = ['/usr/bin/prlimit', '/bin/prlimit'].find((candidate) => fs.existsSync(candidate));
const MAX_DIAGNOSTICS = 120;

export const availableEngines = (compileConfig) =>
  compileConfig.allowLuaLatex ? ['pdflatex', 'xelatex', 'lualatex'] : ['pdflatex', 'xelatex'];

class Gate {
  constructor(concurrency, queueLimit) {
    this.concurrency = concurrency;
    this.queueLimit = queueLimit;
    this.active = 0;
    this.waiting = [];
  }

  async acquire() {
    if (this.active < this.concurrency) {
      this.active += 1;
      return;
    }
    if (this.waiting.length >= this.queueLimit) {
      throw new HttpError(503, 'The compile queue is full. Try again in a moment.', 'busy');
    }
    await new Promise((resolve) => this.waiting.push(resolve));
  }

  release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.active -= 1;
  }
}

const scrub = (text, dir) => text.split(dir).join('.').replaceAll('\0', '');

const normalizeLogPath = (file) => file.replace(/^\.\//, '');

export const parseDiagnostics = (log, mainFile) => {
  const lines = log.split(/\r?\n/);
  const diagnostics = [];
  const seen = new Set();
  const push = (entry) => {
    if (diagnostics.length >= MAX_DIAGNOSTICS) return;
    const key = `${entry.type}|${entry.file}|${entry.line}|${entry.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    diagnostics.push(entry);
  };

  const fileLineError = /^(?:\.\/)?([A-Za-z0-9][A-Za-z0-9._/-]*\.(?:tex|sty|cls|bib|def|cfg|bst)):(\d+): (.+)$/;
  const bangError = /^! (.+)$/;
  let sawLocatedError = false;

  for (const line of lines) {
    const match = fileLineError.exec(line);
    if (match) {
      sawLocatedError = true;
      push({ type: 'error', file: normalizeLogPath(match[1]), line: Number(match[2]), message: match[3].trim() });
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!sawLocatedError) {
      const bang = bangError.exec(line);
      if (bang) {
        const location = lines.slice(i + 1, i + 8).map((l) => /^l\.(\d+)/.exec(l)).find(Boolean);
        push({ type: 'error', file: mainFile, line: location ? Number(location[1]) : null, message: bang[1].trim() });
      }
    }

    const warning = /^(LaTeX|Package \S+|Class \S+) Warning: (.*)$/.exec(line);
    if (warning) {
      let message = warning[2];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && j < i + 6) {
        message += ` ${lines[j].replace(/^\(\S+\)\s*/, '').trim()}`;
        j += 1;
      }
      const onLine = /on input line (\d+)/.exec(message);
      push({
        type: 'warning',
        file: mainFile,
        line: onLine ? Number(onLine[1]) : null,
        message: message.replace(/\s+/g, ' ').replace(/\s*on input line \d+\.?$/, '').trim(),
      });
      continue;
    }

    const box = /^(Overfull|Underfull) \\([hv])box \((.+?)\) (?:in paragraph at lines|in alignment at lines|detected at line|at lines) (\d+)/.exec(line);
    if (box) {
      push({ type: 'info', file: mainFile, line: Number(box[4]), message: `${box[1]} \\${box[2]}box (${box[3]})` });
    }
  }

  return diagnostics.sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[a.type] - rank[b.type] || (a.line ?? 0) - (b.line ?? 0);
  });
};

export class Compiler {
  constructor(compileConfig, dataDir) {
    this.config = compileConfig;
    this.gate = new Gate(compileConfig.concurrency, compileConfig.queueLimit);
    this.running = new Set();
    this.cacheDir = dataDir === ':memory:' ? path.join(os.tmpdir(), 'texflow-cache') : path.join(dataDir, 'cache');
  }

  isRunning(projectId) {
    return this.running.has(projectId);
  }

  async compile({ projectId, files, mainFile, engine }) {
    if (this.running.has(projectId)) throw new HttpError(409, 'A build is already running for this project', 'busy');
    this.running.add(projectId);
    try {
      await this.gate.acquire();
    } catch (error) {
      this.running.delete(projectId);
      throw error;
    }
    try {
      return await this.execute({ files, mainFile, engine });
    } finally {
      this.gate.release();
      this.running.delete(projectId);
    }
  }

  async execute({ files, mainFile, engine }) {
    const startedAt = Date.now();
    fs.mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'texflow-build-'));
    const base = path.basename(mainFile, '.tex');

    try {
      for (const file of files) {
        const target = path.join(dir, file.path);
        if (!target.startsWith(`${dir}${path.sep}`)) continue;
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target, file.content, { mode: 0o600 });
      }
      await fs.promises.rm(path.join(dir, `${base}.pdf`), { force: true });

      const output = await this.run(dir, mainFile, engine);

      let log = '';
      try {
        const raw = await fs.promises.readFile(path.join(dir, `${base}.log`), 'utf8');
        log = raw.length > this.config.maxLogBytes ? raw.slice(-this.config.maxLogBytes) : raw;
      } catch {
        log = output.text;
      }
      log = scrub(log, dir);

      let pdf = null;
      try {
        const stat = await fs.promises.stat(path.join(dir, `${base}.pdf`));
        if (stat.size > 0 && stat.size <= this.config.maxPdfBytes) {
          pdf = await fs.promises.readFile(path.join(dir, `${base}.pdf`));
        }
      } catch {
        pdf = null;
      }

      const diagnostics = parseDiagnostics(log, mainFile);
      if (output.timedOut) {
        diagnostics.unshift({
          type: 'error',
          file: null,
          line: null,
          message: `The build took longer than ${Math.round(this.config.timeoutMs / 1000)} seconds and was stopped.`,
        });
      } else if (!pdf && !diagnostics.some((d) => d.type === 'error')) {
        diagnostics.unshift({ type: 'error', file: null, line: null, message: 'The build did not produce a PDF. Check the log for details.' });
      }

      return {
        ok: Boolean(pdf) && !diagnostics.some((d) => d.type === 'error'),
        pdf,
        log,
        diagnostics,
        durationMs: Date.now() - startedAt,
      };
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  run(cwd, mainFile, engine) {
    const latexmkArgs = [
      'latexmk',
      ENGINE_FLAGS[engine] ?? '-pdf',
      '-interaction=nonstopmode',
      '-file-line-error',
      '-f',
      '-quiet',
      mainFile,
    ];

    const command = PRLIMIT
      ? [PRLIMIT, `--cpu=${Math.ceil(this.config.timeoutMs / 1000) + 10}`, '--fsize=134217728', '--core=0', '--nofile=1024', '--', ...latexmkArgs]
      : latexmkArgs;

    const env = {
      PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
      HOME: cwd,
      TMPDIR: cwd,
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      XDG_CONFIG_HOME: path.join(cwd, '.config'),
      XDG_CACHE_HOME: this.cacheDir,
      TEXMFVAR: path.join(this.cacheDir, 'texmf-var'),
      TEXMFCONFIG: path.join(cwd, '.texmf-config'),
      openin_any: 'p',
      openout_any: 'p',
      shell_escape: 'f',
      SOURCE_DATE_EPOCH: String(Math.floor(Date.now() / 1000)),
    };

    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        cwd,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let text = '';
      let timedOut = false;
      const collect = (chunk) => {
        if (text.length < this.config.maxLogBytes) text += chunk.toString('utf8');
      };
      child.stdout.on('data', collect);
      child.stderr.on('data', collect);

      const killGroup = () => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      };

      const timer = setTimeout(() => {
        timedOut = true;
        killGroup();
      }, this.config.timeoutMs);

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(
          error.code === 'ENOENT'
            ? new HttpError(503, 'LaTeX is not available on this server', 'no_latex')
            : new HttpError(500, 'The build could not be started'),
        );
      });

      child.on('close', () => {
        clearTimeout(timer);
        killGroup();
        resolve({ text, timedOut });
      });
    });
  }
}
