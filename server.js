// 햄버거 공장 개발/배포 서버.
// Node 내장 모듈(http, fs, path)만 사용한다. public/ 폴더 안의 허용된 파일만 서빙한다.
import http from 'node:http';
import { stat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// 확장자 허용 목록. 여기에 없는 확장자는 존재하더라도 404.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; " +
    "font-src 'self'; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; " +
    "form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function respond(req, res, status, headers = {}, body = '') {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Cache-Control': 'no-cache', ...headers });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function respondText(req, res, status, text, headers = {}) {
  respond(req, res, status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers }, text);
}

const notFound = (req, res) => respondText(req, res, 404, 'Not Found');

/** 요청 경로를 public/ 아래의 실제 파일 경로로 바꾼다. 허용되지 않으면 null. */
function resolvePublicPath(rawUrl) {
  const rawPath = rawUrl.split('?')[0].split('#')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  if (!decoded.startsWith('/')) return null;

  const relative = decoded === '/' ? 'index.html' : decoded.slice(1);
  // 폴더 요청은 목록을 주지 않고 404.
  if (relative.endsWith('/')) return null;

  const segments = relative.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..' || s.startsWith('.'))) return null;

  const resolved = path.resolve(PUBLIC_DIR, path.normalize(relative));
  if (!resolved.startsWith(PUBLIC_DIR + path.sep)) return null;
  if (!Object.hasOwn(MIME, path.extname(resolved).toLowerCase())) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return respondText(req, res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const rawPath = (req.url || '/').split('?')[0];
  if (rawPath === '/index.html') {
    return respondText(req, res, 301, 'Moved Permanently', { Location: '/' });
  }

  const filePath = resolvePublicPath(req.url || '/');
  if (!filePath) return notFound(req, res);

  try {
    // 심볼릭 링크로 public/ 밖을 가리키는 경우도 막는다.
    const real = await realpath(filePath);
    const realPublic = await realpath(PUBLIC_DIR);
    if (!real.startsWith(realPublic + path.sep)) return notFound(req, res);

    const info = await stat(real);
    if (!info.isFile()) return notFound(req, res);

    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': MIME[path.extname(real).toLowerCase()],
      ETag: etag,
      'Last-Modified': info.mtime.toUTCString(),
    };
    if (req.headers['if-none-match'] === etag) {
      return respond(req, res, 304, headers);
    }
    const body = await readFile(real);
    respond(req, res, 200, { ...headers, 'Content-Length': body.length }, body);
  } catch {
    notFound(req, res);
  }
});

server.on('clientError', (_err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(PORT, HOST, () => {
  console.log(`햄버거 공장 서버: http://localhost:${PORT}/  (바인딩 ${HOST})`);
});
