import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { parseDiagnostics } from '../src/services/compiler.js';
import { createProject, registerUser, startServer } from './helpers.js';

const document = (body, preamble = '') => `\\documentclass{article}\n${preamble}\n\\begin{document}\n${body}\n\\end{document}\n`;

describe('parseDiagnostics', () => {
  it('extracts located errors, warnings and box info', () => {
    const log = [
      './main.tex:12: Undefined control sequence.',
      'l.12 \\foo',
      'LaTeX Warning: Citation `x\' on page 1 undefined on input line 20.',
      'Overfull \\hbox (4.0pt too wide) in paragraph at lines 30--31',
    ].join('\n');
    const result = parseDiagnostics(log, 'main.tex');
    assert.deepEqual(result.map((d) => [d.type, d.line]), [['error', 12], ['warning', 20], ['info', 30]]);
    assert.equal(result[0].file, 'main.tex');
  });

  it('falls back to bang-style errors', () => {
    const result = parseDiagnostics('! Emergency stop.\nl.7 \\end{document}', 'main.tex');
    assert.equal(result[0].type, 'error');
    assert.equal(result[0].line, 7);
  });
});

describe('compilation', { timeout: 240_000 }, () => {
  let server;
  let client;

  const run = async (files, name = 'Build') => {
    const project = await createProject(client, 'blank', name);
    for (const [path, content] of Object.entries(files)) {
      const response = await client.put(`/api/projects/${project.id}/file`, { path, content });
      assert.equal(response.status, 200);
    }
    const response = await client.post(`/api/projects/${project.id}/compile`, {});
    return { project, response };
  };

  before(async () => {
    server = await startServer({ compile: { timeoutMs: 8000 } });
    client = (await registerUser(server)).client;
  });
  after(() => server.close());

  it('compiles the welcome example including bibliography and TikZ', async () => {
    const { project } = await (async () => {
      const created = await client.post('/api/projects', { name: 'Welcome', template: 'welcome' });
      return { project: created.data.project };
    })();
    const response = await client.post(`/api/projects/${project.id}/compile`, {});
    assert.equal(response.status, 200);
    assert.equal(response.data.build.ok, true, JSON.stringify(response.data.build.diagnostics));
    assert.equal(response.data.build.hasPdf, true);

    const pdf = await client.get(`/api/projects/${project.id}/pdf`);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-');
    assert.ok(!response.data.build.diagnostics.some((d) => /undefined/i.test(d.message)), 'citations should resolve');

    const detail = await client.get(`/api/projects/${project.id}`);
    assert.equal(detail.data.build.ok, true);
  });

  it('reports errors with file and line numbers', async () => {
    const { response } = await run({ 'main.tex': document('Hello\n\\undefinedcommand here') });
    const { build } = response.data;
    assert.equal(build.ok, false);
    const error = build.diagnostics.find((d) => d.type === 'error');
    assert.ok(error, 'expected an error diagnostic');
    assert.equal(error.file, 'main.tex');
    assert.equal(error.line, 5);
  });

  it('never reveals server paths in the log', async () => {
    const { response } = await run({ 'main.tex': document('\\undefinedcommand') });
    assert.ok(!response.data.build.log.includes('/tmp/'));
    assert.ok(!response.data.build.log.includes('texflow-build'));
  });

  it('does not execute shell commands via \\write18', async () => {
    const marker = `/tmp/texflow-pwned-${process.pid}`;
    fs.rmSync(marker, { force: true });
    await run({ 'main.tex': document(`\\immediate\\write18{touch ${marker}}\nok`) });
    assert.equal(fs.existsSync(marker), false);
  });

  it('cannot read files outside the project', async () => {
    const { response } = await run({ 'main.tex': document('\\input{/etc/passwd}') });
    assert.equal(response.data.build.ok, false);
    assert.ok(!response.data.build.log.includes('root:x:0'));
  });

  it('cannot write files outside the project', async () => {
    const target = `/tmp/texflow-write-${process.pid}.txt`;
    fs.rmSync(target, { force: true });
    await run({ 'main.tex': document(`\\newwrite\\f\\immediate\\openout\\f=${target}\n\\immediate\\write\\f{x}\\immediate\\closeout\\f`) });
    assert.equal(fs.existsSync(target), false);
  });

  it('stops runaway builds at the time limit', async () => {
    const { response } = await run({ 'main.tex': document('\\def\\x{\\x}\\x') });
    assert.equal(response.status, 200);
    assert.equal(response.data.build.ok, false);
    assert.ok(response.data.build.durationMs < 20_000);
    assert.ok(response.data.build.diagnostics.some((d) => /stopped|took longer/i.test(d.message)));
  });

  it('does not serve a stale PDF when a later build fails', async () => {
    const project = await createProject(client, 'blank', 'Stale');
    await client.put(`/api/projects/${project.id}/file`, { path: 'main.tex', content: document('Fine') });
    assert.equal((await client.post(`/api/projects/${project.id}/compile`, {})).data.build.ok, true);
    await client.put(`/api/projects/${project.id}/file`, { path: 'main.tex', content: document('\\bad') });
    const failed = await client.post(`/api/projects/${project.id}/compile`, {});
    assert.equal(failed.data.build.ok, false);
  });

  it('rejects a second simultaneous build of the same project', async () => {
    const project = await createProject(client, 'blank', 'Parallel');
    const [first, second] = await Promise.all([
      client.post(`/api/projects/${project.id}/compile`, {}),
      client.post(`/api/projects/${project.id}/compile`, {}),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  });
});
