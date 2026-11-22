export class ApiError extends Error {
  constructor(status, message, code, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let unauthorizedHandler = () => {};
export const onUnauthorized = (handler) => {
  unauthorizedHandler = handler;
};

const request = async (method, url, { body, raw = false, quiet401 = false } = {}) => {
  const headers = { 'X-Requested-With': 'texflow' };
  let payload;
  if (body !== undefined) {
    if (raw) {
      payload = body;
      headers['Content-Type'] = 'application/octet-stream';
    } else {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'You appear to be offline. Check your connection and try again.', 'network');
  }

  if (response.status === 204) return null;

  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && !quiet401) unauthorizedHandler();
    throw new ApiError(
      response.status,
      data?.error?.message ?? 'Something went wrong. Please try again.',
      data?.error?.code,
      data?.error?.fields,
    );
  }
  return data;
};

const enc = encodeURIComponent;

export const api = {
  meta: () => request('GET', '/api/meta'),
  me: () => request('GET', '/api/auth/me'),
  login: (body) => request('POST', '/api/auth/login', { body, quiet401: true }),
  register: (body) => request('POST', '/api/auth/register', { body, quiet401: true }),
  logout: () => request('POST', '/api/auth/logout', { body: {}, quiet401: true }),

  listProjects: () => request('GET', '/api/projects'),
  createProject: (body) => request('POST', '/api/projects', { body }),
  getProject: (id) => request('GET', `/api/projects/${enc(id)}`),
  updateProject: (id, body) => request('PATCH', `/api/projects/${enc(id)}`, { body }),
  deleteProject: (id) => request('DELETE', `/api/projects/${enc(id)}`),
  duplicateProject: (id) => request('POST', `/api/projects/${enc(id)}/duplicate`, { body: {} }),

  saveFile: (id, path, content) => request('PUT', `/api/projects/${enc(id)}/file`, { body: { path, content } }),
  uploadFile: (id, path, file) => request('POST', `/api/projects/${enc(id)}/upload?path=${enc(path)}`, { body: file, raw: true }),
  renameFile: (id, from, to) => request('POST', `/api/projects/${enc(id)}/file/rename`, { body: { from, to } }),
  deleteFile: (id, path) => request('DELETE', `/api/projects/${enc(id)}/file?path=${enc(path)}`),
  compile: (id) => request('POST', `/api/projects/${enc(id)}/compile`, { body: {} }),

  pdfUrl: (id, stamp) => `/api/projects/${enc(id)}/pdf?v=${stamp ?? 0}`,
  pdfDownloadUrl: (id) => `/api/projects/${enc(id)}/pdf?download=1`,
  sourceUrl: (id) => `/api/projects/${enc(id)}/source.zip`,
  rawUrl: (id, path) => `/api/projects/${enc(id)}/raw?path=${enc(path)}`,
};
