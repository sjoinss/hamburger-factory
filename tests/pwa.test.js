// 홈 화면 추가(PWA): 매니페스트와 아이콘, 페이지 쪽 CSP
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url));

/** PNG 머리에서 가로·세로 */
function pngSize(buf) {
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('매니페스트: 상대 경로, 아이콘 크기가 적힌 대로', () => {
  const mf = JSON.parse(read('manifest.webmanifest'));
  assert.equal(mf.start_url, './', 'Pages 하위 경로에서도 열리게');
  assert.ok(mf.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of mf.icons) {
    assert.ok(!icon.src.startsWith('/'), '절대 경로 금지');
    const [w, h] = pngSize(read(icon.src));
    assert.equal(`${w}x${h}`, icon.sizes);
  }
});

test('index.html: 매니페스트 연결, CSP 가 서비스 워커·매니페스트를 허용', () => {
  const html = read('index.html').toString('utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/icon-180\.png">/);
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /worker-src 'self'/);
  assert.match(csp, /manifest-src 'self'/);
  assert.match(csp, /default-src 'none'/);
});

test('서비스 워커: 다른 사이트 요청은 건드리지 않고 GET 만 다룬다', () => {
  const sw = read('sw.js').toString('utf8');
  assert.match(sw, /req\.method !== 'GET' \|\| !sameOrigin\(req\.url\)\) return;/);
  assert.match(sw, /res\.type !== 'basic'/, '불투명 응답은 담지 않는다');
});
