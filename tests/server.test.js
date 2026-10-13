// 17.7 서버 확인 항목 자동 점검.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3000 + Math.floor(Math.random() * 2000) + 20000;
let child;

function request(method, rawPath) {
  return new Promise((resolve, reject) => {
    // 경로를 정규화하지 않고 그대로 보내기 위해 http.request 사용
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: rawPath }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => { if (String(d).includes('http://')) resolve(); });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
});

after(() => child?.kill());

test('/ 에서 index.html 내용을 응답한다', async () => {
  const res = await request('GET', '/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.body, /<canvas id="game"/);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('/index.html 은 / 로 301', async () => {
  const res = await request('GET', '/index.html');
  assert.equal(res.status, 301);
  assert.equal(res.headers.location, '/');
});

for (const p of [
  '/server.js', '/package.json', '/../server.js', '/%2e%2e/server.js', '/%2E%2E%2Fserver.js',
  '/.env', '/js/../../server.js', '/js%5c..%5c..%5cserver.js', '/js/main.js%00.css',
  '/js/', '/data/', '/js', '/README.md', '/assets/fonts/README.txt/', '/nope.map',
]) {
  test(`${p} → 404`, async () => {
    const res = await request('GET', p);
    assert.equal(res.status, 404);
    assert.equal(res.body, 'Not Found');
  });
}

test('POST 는 405', async () => {
  const res = await request('POST', '/');
  assert.equal(res.status, 405);
  assert.equal(res.headers.allow, 'GET, HEAD');
});

test('정적 파일과 MIME', async () => {
  const js = await request('GET', '/js/main.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /text\/javascript/);
  const json = await request('GET', '/data/palette.json');
  assert.match(json.headers['content-type'], /application\/json/);
});

test('모든 응답에 보안 헤더, 서버 정보 없음', async () => {
  for (const p of ['/', '/js/main.js', '/nope', '/index.html']) {
    const res = await request('GET', p);
    assert.match(res.headers['content-security-policy'], /default-src 'none'; script-src 'self'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin');
    assert.equal(res.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers.server, undefined);
  }
});

test('ETag 조건부 요청은 304', async () => {
  const first = await request('GET', '/css/ui.css');
  const res = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/css/ui.css', headers: { 'If-None-Match': first.headers.etag } }, (r) => {
      r.resume();
      r.on('end', () => resolve(r));
    }).on('error', reject);
  });
  assert.equal(res.statusCode, 304);
});
