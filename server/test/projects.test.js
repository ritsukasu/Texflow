import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { unzipSync } from 'fflate';
import { createProject, registerUser, startServer } from './helpers.js';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300', 'hex');

describe('projects and files', () => {
  let server;
  let alice;
  let bob;
  let project;

  before(async () => {
    server = await startServer({ limits: { filesPerProject: 6, projectsPerUser: 8, projectBytes: 64 * 1024 } });
    alice = (await registerUser(server)).client;
    bob = (await registerUser(server)).client;
    project = await createProject(alice, 'article', 'Alice paper');
  });
  after(() => server.close());

  it('creates projects from templates with a main file', async () => {
    assert.equal(project.mainFile, 'main.tex');
    const detail = await alice.get(`/api/projects/${project.id}`);
    assert.equal(detail.status, 200);
    assert.ok(detail.data.files.some((file) => file.path === 'main.tex' && file.content.includes('\\documentclass')));
    assert.deepEqual(detail.data.engines, ['pdflatex', 'xelatex']);
  });

  it('hides other users projects behind a 404 on every route', async () => {
    const id = project.id;
    const attempts = [
      bob.get(`/api/projects/${id}`),
      bob.patch(`/api/projects/${id}`, { name: 'stolen' }),
      bob.del(`/api/projects/${id}`),
      bob.put(`/api/projects/${id}/file`, { path: 'evil.tex', content: 'x' }),
      bob.get(`/api/projects/${id}/raw?path=main.tex`),
      bob.post(`/api/projects/${id}/compile`, {}),
      bob.get(`/api/projects/${id}/pdf`),
      bob.get(`/api/projects/${id}/source.zip`),
      bob.post(`/api/projects/${id}/duplicate`, {}),
    ];
    for (const response of await Promise.all(attempts)) assert.equal(response.status, 404);

    const list = await bob.get('/api/projects');
    assert.ok(!list.data.projects.some((p) => p.id === id));
    assert.equal((await alice.get(`/api/projects/${id}`)).data.project.name, 'Alice paper');
  });

  it('treats malformed project ids as not found', async () => {
    assert.equal((await alice.get('/api/projects/not-a-uuid')).status, 404);
    assert.equal((await alice.get("/api/projects/1'%20OR%20'1'='1")).status, 404);
  });

  it('ignores attempts to mass-assign protected fields', async () => {
    const response = await alice.patch(`/api/projects/${project.id}`, { name: 'Renamed', userId: 'someone-else', id: 'x' });
    assert.equal(response.status, 200);
    assert.equal(response.data.project.id, project.id);
    assert.equal((await bob.get(`/api/projects/${project.id}`)).status, 404);
  });

  it('saves and reads text files', async () => {
    const save = await alice.put(`/api/projects/${project.id}/file`, { path: 'notes.txt', content: 'héllo ✓' });
    assert.equal(save.status, 200);
    const raw = await alice.get(`/api/projects/${project.id}/raw?path=notes.txt`);
    assert.equal(raw.data.toString('utf8'), 'héllo ✓');
    assert.match(raw.headers.get('content-security-policy'), /sandbox/);
  });

  const BAD_PATHS = ['../etc/passwd', '/etc/passwd', 'a/../../b.tex', '.hidden.tex', 'latexmkrc', '.latexmkrc', 'a\\b.tex', 'x.sh', 'noext', 'a//b.tex', 'a/b/c/d/e.tex', 'bad name.tex', 'x.tex\0.png', 'con..tex'];
  for (const badPath of BAD_PATHS) {
    it(`rejects unsafe path ${JSON.stringify(badPath)}`, async () => {
      const response = await alice.put(`/api/projects/${project.id}/file`, { path: badPath, content: 'x' });
      assert.equal(response.status, 422);
    });
  }

  it('rejects uploads whose content does not match their extension', async () => {
    const response = await alice.request('POST', `/api/projects/${project.id}/upload?path=fig.png`, {
      body: Buffer.from('<?php echo 1; ?>'),
      raw: true,
      headers: { 'content-type': 'application/octet-stream' },
    });
    assert.equal(response.status, 415);
  });

  it('accepts a valid image upload and serves it back with the right type', async () => {
    const upload = await alice.request('POST', `/api/projects/${project.id}/upload?path=figures/dot.png`, {
      body: PNG,
      raw: true,
      headers: { 'content-type': 'application/octet-stream' },
    });
    assert.equal(upload.status, 201);
    const raw = await alice.get(`/api/projects/${project.id}/raw?path=figures/dot.png`);
    assert.equal(raw.headers.get('content-type'), 'image/png');
    assert.deepEqual(raw.data, PNG);
  });

  it('refuses to edit binary files as text and text files as uploads', async () => {
    assert.equal((await alice.put(`/api/projects/${project.id}/file`, { path: 'x.png', content: 'x' })).status, 415);
    const upload = await alice.request('POST', `/api/projects/${project.id}/upload?path=x.tex`, { body: Buffer.from('x'), raw: true, headers: { 'content-type': 'application/octet-stream' } });
    assert.equal(upload.status, 415);
  });

  it('renames files and keeps the main file pointer in sync', async () => {
    const rename = await alice.post(`/api/projects/${project.id}/file/rename`, { from: 'main.tex', to: 'paper.tex' });
    assert.equal(rename.status, 200);
    assert.equal((await alice.get(`/api/projects/${project.id}`)).data.project.mainFile, 'paper.tex');
    await alice.post(`/api/projects/${project.id}/file/rename`, { from: 'paper.tex', to: 'main.tex' });
  });

  it('refuses to overwrite on rename, to change file kinds, or to delete the main file', async () => {
    assert.equal((await alice.post(`/api/projects/${project.id}/file/rename`, { from: 'notes.txt', to: 'main.tex' })).status, 409);
    assert.equal((await alice.post(`/api/projects/${project.id}/file/rename`, { from: 'notes.txt', to: 'notes.png' })).status, 422);
    assert.equal((await alice.del(`/api/projects/${project.id}/file?path=main.tex`)).status, 409);
  });

  it('deletes files', async () => {
    assert.equal((await alice.del(`/api/projects/${project.id}/file?path=notes.txt`)).status, 204);
    assert.equal((await alice.del(`/api/projects/${project.id}/file?path=notes.txt`)).status, 404);
  });

  it('enforces per-project file and size quotas', async () => {
    const quota = await createProject(alice, 'blank', 'Quota');
    let last;
    for (let i = 0; i < 8; i += 1) {
      last = await alice.put(`/api/projects/${quota.id}/file`, { path: `f${i}.tex`, content: 'x' });
    }
    assert.equal(last.status, 409);

    const big = await createProject(alice, 'blank', 'Big');
    const overflow = await alice.put(`/api/projects/${big.id}/file`, { path: 'huge.tex', content: 'a'.repeat(70 * 1024) });
    assert.equal(overflow.status, 413);
  });

  it('enforces the per-user project quota', async () => {
    const carol = (await registerUser(server)).client;
    for (let i = 0; i < 7; i += 1) await createProject(carol, 'blank', `P${i}`);
    const response = await carol.post('/api/projects', { name: 'one too many', template: 'blank' });
    assert.equal(response.status, 409);
  });

  it('only exposes allowed engines and validates the main file', async () => {
    assert.equal((await alice.patch(`/api/projects/${project.id}`, { engine: 'lualatex' })).status, 422);
    assert.equal((await alice.patch(`/api/projects/${project.id}`, { engine: 'xelatex' })).status, 200);
    assert.equal((await alice.patch(`/api/projects/${project.id}`, { mainFile: 'missing.tex' })).status, 404);
    assert.equal((await alice.patch(`/api/projects/${project.id}`, { mainFile: '../x.tex' })).status, 422);
    assert.equal((await alice.patch(`/api/projects/${project.id}`, {})).status, 422);
  });

  it('duplicates and deletes projects with cascading cleanup', async () => {
    const source = await createProject(alice, 'welcome', 'Original');
    const copy = await alice.post(`/api/projects/${source.id}/duplicate`, {});
    assert.equal(copy.status, 201);
    const copyFiles = (await alice.get(`/api/projects/${copy.data.project.id}`)).data.files;
    assert.ok(copyFiles.length >= 2);

    assert.equal((await alice.del(`/api/projects/${source.id}`)).status, 204);
    assert.equal((await alice.get(`/api/projects/${source.id}`)).status, 404);
    assert.equal(server.db.prepare('SELECT COUNT(*) AS n FROM files WHERE project_id = ?').get(source.id).n, 0);
  });

  it('exports a source archive', async () => {
    const response = await alice.get(`/api/projects/${project.id}/source.zip`);
    assert.equal(response.status, 200);
    const entries = unzipSync(new Uint8Array(response.data));
    assert.ok(entries['main.tex']);
    assert.ok(entries['figures/dot.png']);
  });
});
