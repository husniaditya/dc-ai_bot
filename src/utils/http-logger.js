// Centralized HTTP response logger
// - Captures axios and global fetch responses
// - Appends entries to log/log_YYYY-MM-DD.json (JSON Lines: one entry per line)
// - Redacts sensitive headers

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

let initialized = false;

const LOG_DIR = path.resolve(__dirname, '..', '..', 'log');

function getLogFilePath(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return path.join(LOG_DIR, `log_${yyyy}-${mm}-${dd}.json`);
}

function redactHeaders(headers) {
  if (!headers) return headers;
  const redacted = {};
  const SENSITIVE = new Set([
    'authorization', 'proxy-authorization', 'set-cookie', 'cookie',
    'x-api-key', 'x-apikey', 'api-key', 'apikey', 'x-auth-token', 'x-token'
  ]);
  for (const [k, v] of Object.entries(headers)) {
    const key = String(k).toLowerCase();
    redacted[key] = SENSITIVE.has(key) ? '[REDACTED]' : v;
  }
  return redacted;
}

async function appendLog(entry) {
  try {
    await fsp.mkdir(LOG_DIR, { recursive: true });
    const file = getLogFilePath(new Date(entry.timestamp || Date.now()));
    const line = JSON.stringify(entry) + '\n';
    await fsp.appendFile(file, line, 'utf8');
  } catch (e) {
    // Avoid throwing from logger
    // eslint-disable-next-line no-console
    console.warn('[http-logger] append failed:', e.message);
  }
}

function safeSerializeBody(body, contentType) {
  try {
    if (body == null) return null;
    if (typeof body === 'string') {
      return body.length > 200000 ? body.slice(0, 200000) + '...<truncated>' : body;
    }
    if (Buffer.isBuffer(body)) {
      // Avoid storing raw binary in logs
      return `<buffer ${body.length} bytes>`;
    }
    // JSON or plain object
    const str = JSON.stringify(body);
    return str.length > 200000 ? str.slice(0, 200000) + '...<truncated>' : JSON.parse(str);
  } catch {
    return contentType && String(contentType).includes('application/json')
      ? '<invalid json>'
      : '<unserializable body>';
  }
}

function initAxiosInterceptor() {
  let axios;
  try { axios = require('axios'); } catch { return; }

  // Response interceptor
  axios.interceptors.response.use(
    async (response) => {
      try {
        const req = response.config || {};
        const ct = response.headers ? (response.headers['content-type'] || response.headers['Content-Type']) : undefined;
        // axios may return arraybuffer/stream, attempt to log summary
        const serialized = req.responseType === 'arraybuffer' || req.responseType === 'stream'
          ? `<${req.responseType || 'binary'} response>`
          : safeSerializeBody(response.data, ct);

        await appendLog({
          timestamp: new Date().toISOString(),
          source: 'axios',
          request: {
            method: (req.method || 'get').toUpperCase(),
            url: req.url,
            baseURL: req.baseURL,
            headers: redactHeaders(req.headers || {}),
            params: req.params || undefined,
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: redactHeaders(response.headers || {}),
            contentType: ct,
            data: serialized,
          },
        });
      } catch (e) {
        // ignore logging failures
      }
      return response;
    },
    async (error) => {
      try {
        const req = (error && error.config) || {};
        const resp = error && error.response;
        const ct = resp && resp.headers ? (resp.headers['content-type'] || resp.headers['Content-Type']) : undefined;
        const serialized = resp ? safeSerializeBody(resp.data, ct) : null;
        await appendLog({
          timestamp: new Date().toISOString(),
          source: 'axios',
          request: {
            method: (req.method || 'GET').toUpperCase(),
            url: req.url,
            baseURL: req.baseURL,
            headers: redactHeaders(req.headers || {}),
            params: req.params || undefined,
          },
          response: resp ? {
            status: resp.status,
            statusText: resp.statusText,
            headers: redactHeaders(resp.headers || {}),
            contentType: ct,
            data: serialized,
          } : null,
          error: {
            message: error && error.message,
            code: error && error.code,
          },
        });
      } catch {}
      return Promise.reject(error);
    }
  );
}

function initFetchPatch() {
  if (typeof globalThis.fetch !== 'function') return;
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async function patchedFetch(input, init) {
    const started = Date.now();
    let url = '';
    let method = 'GET';
    let reqHeaders = {};
    try {
      // Build a Request to normalize values
      const req = new Request(input, init);
      url = req.url;
      method = req.method || 'GET';
      // Headers -> plain object
      for (const [k, v] of req.headers.entries()) reqHeaders[k] = v;
    } catch {
      // Fallback best-effort
      url = typeof input === 'string' ? input : (input && input.url) || '';
      method = (init && init.method) || 'GET';
      reqHeaders = init && init.headers ? init.headers : {};
    }

    try {
      const res = await originalFetch(input, init);
      let contentType = res.headers.get('content-type') || res.headers.get('Content-Type');
      let dataSummary = null;
      try {
        const clone = res.clone();
        if (contentType && contentType.includes('application/json')) {
          const json = await clone.json().catch(() => null);
          dataSummary = safeSerializeBody(json, contentType);
        } else if (contentType && contentType.startsWith('text/')) {
          const text = await clone.text().catch(() => '');
          dataSummary = safeSerializeBody(text, contentType);
        } else {
          const len = res.headers.get('content-length');
          dataSummary = `<non-text content${len ? ', ' + len + ' bytes' : ''}>`;
        }
      } catch {
        dataSummary = '<unreadable body>';
      }

      await appendLog({
        timestamp: new Date().toISOString(),
        source: 'fetch',
        durationMs: Date.now() - started,
        request: {
          method,
          url,
          headers: redactHeaders(reqHeaders),
        },
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: (() => {
            const h = {}; for (const [k, v] of res.headers.entries()) h[k] = v; return redactHeaders(h);
          })(),
          contentType,
          data: dataSummary,
        },
      });

      return res;
    } catch (error) {
      await appendLog({
        timestamp: new Date().toISOString(),
        source: 'fetch',
        durationMs: Date.now() - started,
        request: { method, url, headers: redactHeaders(reqHeaders) },
        error: { message: error && error.message }
      });
      throw error;
    }
  };
}

function init() {
  if (initialized) return;
  initialized = true;
  // Ensure directory exists eagerly
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
  initAxiosInterceptor();
  initFetchPatch();
}

module.exports = { init };
