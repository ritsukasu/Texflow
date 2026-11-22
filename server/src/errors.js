export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code ?? defaultCode(status);
  }
}

const defaultCode = (status) =>
  ({
    400: 'bad_request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
    413: 'too_large',
    415: 'unsupported_type',
    422: 'invalid',
    429: 'rate_limited',
    503: 'unavailable',
  })[status] ?? 'error';

export const badRequest = (message = 'Invalid request') => new HttpError(400, message);
export const unauthorized = (message = 'Please sign in to continue') => new HttpError(401, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);
export const tooLarge = (message) => new HttpError(413, message);
