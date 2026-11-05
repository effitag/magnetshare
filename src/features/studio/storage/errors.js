// Errors the storage layer raises, and how to tell a dropped connection from a real failure.

/** The template was saved elsewhere (another tab or computer) since this copy was loaded. */
export class ConflictError extends Error {
  constructor(latestRevision) {
    super('The template was saved elsewhere since it was opened');
    this.name = 'ConflictError';
    this.latestRevision = latestRevision;
  }
}

export class NotFoundError extends Error {
  constructor(what = 'Template') {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnsupportedImageError extends Error {
  constructor(type) {
    super(`Unsupported image type: ${type || 'unknown'}`);
    this.name = 'UnsupportedImageError';
  }
}

const NETWORK_MESSAGE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|internet_disconnected|err_network/i;

export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  if (err.name === 'AuthRetryableFetchError') return true;
  return NETWORK_MESSAGE.test(`${err.message ?? ''} ${err.details ?? ''}`);
}
