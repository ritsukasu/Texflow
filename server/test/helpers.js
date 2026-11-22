import { createApp } from '../src/app.js';
import { config as baseConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { Compiler } from '../src/services/compiler.js';

export const startServer = async ({ rateLimits = false, compile = {}, limits = {}, allowRegistration = true } = {}) => {
  const config = {
    ...baseConfig,
    isTest: true,
    dataDir: ':memory:',
    clientDir: '/nonexistent',
    allowRegistration,
    limits: { ...baseConfig.limits, ...limits },
    compile: { ...baseConfig.compile, ...compile },
  };
  const db = openDatabase(':memory:');
  const compiler = new Compiler(config.compile, ':memory:');
  const app = createApp({ config, db, compiler, rateLimits, logRequests: false });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    db,
    close: () => new Promise((resolve) => server.close(() => { db.close(); resolve(); })),
  };
};

export class Client {
  constructor(base) {
    this.base = base;
    this.cookie = '';
  }

  async request(method, path, { body, headers = {}, raw = false, csrf = true } = {}) {
    const init = {
      method,
      headers: { ...(csrf ? { 'x-requested-with': 'texflow' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
    };
    if (body !== undefined) {
      if (raw) {
        init.body = body;
      } else {
        init.body = JSON.stringify(body);
        init.headers['content-type'] = 'application/json';
      }
    }
    const response = await fetch(`${this.base}${path}`, init);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const pair = setCookie.split(';')[0];
      this.cookie = pair.endsWith('=') ? '' : pair;
      this.lastSetCookie = setCookie;
    }
    const type = response.headers.get('content-type') ?? '';
    let data = null;
    if (type.includes('application/json')) data = await response.json();
    else if (response.status !== 204) data = Buffer.from(await response.arrayBuffer());
    return { status: response.status, data, headers: response.headers };
  }

  get = (path, options) => this.request('GET', path, options);
  post = (path, body, options) => this.request('POST', path, { body, ...options });
  put = (path, body, options) => this.request('PUT', path, { body, ...options });
  patch = (path, body, options) => this.request('PATCH', path, { body, ...options });
  del = (path, options) => this.request('DELETE', path, options);
}

let counter = 0;
export const registerUser = async (server, overrides = {}) => {
  counter += 1;
  const client = new Client(server.base);
  const credentials = {
    name: 'Test User',
    email: `user${counter}-${Date.now()}@example.com`,
    password: 'correct horse battery',
    ...overrides,
  };
  const response = await client.post('/api/auth/register', credentials);
  return { client, credentials, response, user: response.data?.user };
};

export const createProject = async (client, template = 'article', name = 'Test project') => {
  const response = await client.post('/api/projects', { name, template });
  return response.data.project;
};
