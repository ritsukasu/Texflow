import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Client, registerUser, startServer } from './helpers.js';

describe('authentication', () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.close());

  it('registers a user, sets a hardened session cookie and seeds an example project', async () => {
    const { client, response, user } = await registerUser(server);
    assert.equal(response.status, 201);
    assert.ok(user.id);
    assert.equal(response.data.user.password, undefined);
    assert.equal(response.data.user.password_hash, undefined);

    const cookie = client.lastSetCookie.toLowerCase();
    assert.match(cookie, /httponly/);
    assert.match(cookie, /samesite=lax/);

    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, user.email);

    const projects = await client.get('/api/projects');
    assert.equal(projects.data.projects.length, 1);
    assert.equal(projects.data.projects[0].name, 'Getting started');
  });

  it('stores only a hash of the session token', async () => {
    const { client } = await registerUser(server);
    const token = client.cookie.split('=')[1];
    const rows = server.db.prepare('SELECT token_hash FROM sessions').all();
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.token_hash !== token));
  });

  it('stores passwords as salted scrypt hashes', async () => {
    const { credentials } = await registerUser(server);
    const row = server.db.prepare('SELECT password_hash FROM users WHERE email = ?').get(credentials.email);
    assert.match(row.password_hash, /^scrypt\$/);
    assert.ok(!row.password_hash.includes(credentials.password));
  });

  it('rejects weak or malformed registrations with field messages', async () => {
    const client = new Client(server.base);
    const response = await client.post('/api/auth/register', { name: '', email: 'nope', password: 'short' });
    assert.equal(response.status, 422);
    assert.ok(response.data.error.fields.email);
    assert.ok(response.data.error.fields.password);
    assert.ok(response.data.error.fields.name);
  });

  it('does not reveal whether an email is registered', async () => {
    const { credentials } = await registerUser(server);
    const client = new Client(server.base);
    const wrongPassword = await client.post('/api/auth/login', { email: credentials.email, password: 'wrong password!!' });
    const unknownUser = await client.post('/api/auth/login', { email: 'ghost@example.com', password: 'wrong password!!' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUser.status, 401);
    assert.deepEqual(wrongPassword.data, unknownUser.data);
  });

  it('rejects duplicate accounts with a non-specific message', async () => {
    const { credentials } = await registerUser(server);
    const response = await new Client(server.base).post('/api/auth/register', credentials);
    assert.equal(response.status, 409);
    assert.ok(!/already|exists|registered/i.test(response.data.error.message));
  });

  it('signs in and out, invalidating the session server-side', async () => {
    const { credentials } = await registerUser(server);
    const client = new Client(server.base);
    const login = await client.post('/api/auth/login', { email: credentials.email.toUpperCase(), password: credentials.password });
    assert.equal(login.status, 200);
    const stolen = client.cookie;

    assert.equal((await client.post('/api/auth/logout', {})).status, 204);
    assert.equal((await client.get('/api/auth/me')).data.user, null);

    const replay = new Client(server.base);
    replay.cookie = stolen;
    assert.equal((await replay.get('/api/auth/me')).data.user, null);
    assert.equal((await replay.get('/api/projects')).status, 401);
  });

  it('blocks state-changing requests without the CSRF header', async () => {
    const { client } = await registerUser(server);
    const response = await client.post('/api/projects', { name: 'x', template: 'blank' }, { csrf: false });
    assert.equal(response.status, 403);
    assert.equal(response.data.error.code, 'csrf');
  });

  it('blocks requests from a foreign origin', async () => {
    const { client } = await registerUser(server);
    const response = await client.post('/api/projects', { name: 'x', template: 'blank' }, { headers: { origin: 'https://evil.example' } });
    assert.equal(response.status, 403);
  });

  it('requires authentication for project routes', async () => {
    const response = await new Client(server.base).get('/api/projects');
    assert.equal(response.status, 401);
  });

  it('rejects malformed JSON without leaking internals', async () => {
    const client = new Client(server.base);
    const response = await client.request('POST', '/api/auth/login', { body: '{bad', raw: true, headers: { 'content-type': 'application/json' } });
    assert.equal(response.status, 400);
    assert.ok(!JSON.stringify(response.data).includes('node_modules'));
  });

  it('sends security headers', async () => {
    const response = await new Client(server.base).get('/api/health');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-powered-by'), null);
  });
});

describe('registration controls and rate limits', () => {
  it('can close registration', async () => {
    const closed = await startServer({ allowRegistration: false });
    try {
      const { response } = await registerUser(closed);
      assert.equal(response.status, 403);
    } finally {
      await closed.close();
    }
  });

  it('throttles repeated failed sign-ins', async () => {
    const limited = await startServer({ rateLimits: true });
    try {
      const { credentials } = await registerUser(limited);
      const client = new Client(limited.base);
      let last;
      for (let i = 0; i < 10; i += 1) {
        last = await client.post('/api/auth/login', { email: credentials.email, password: 'definitely wrong' });
      }
      assert.equal(last.status, 429);
    } finally {
      await limited.close();
    }
  });
});
