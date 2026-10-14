// 브라우저 스모크 테스트: 진짜 Chrome(헤드리스)으로 게임을 열고 콘솔 에러 없이 돌아가는지 본다.
// 새 패키지 없이 Chrome DevTools 프로토콜을 Node 내장 WebSocket 으로 직접 쓴다.
// Chrome 이 없거나 (CHROME_PATH 로 지정 가능) WebSocket 이 없는 Node 면 건너뛴다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3000 + Math.floor(Math.random() * 2000) + 24000;
const BASE = `http://127.0.0.1:${PORT}/`;

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const CHROME = CANDIDATES.find((p) => p && existsSync(p));
const SKIP = !CHROME ? 'Chrome 없음 (CHROME_PATH 로 지정)' : typeof WebSocket !== 'function' ? 'Node 에 WebSocket 없음 (22 이상)' : false;

let server;
let chrome;
let profile;
let cdp;

/** DevTools 연결: send(method, params, sessionId) + 이벤트 구독 */
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const waiting = new Map();
    const listeners = new Set();
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && waiting.has(msg.id)) {
        const { ok, fail } = waiting.get(msg.id);
        waiting.delete(msg.id);
        if (msg.error) fail(new Error(msg.error.message));
        else ok(msg.result);
      } else if (msg.method) for (const fn of listeners) fn(msg);
    });
    ws.addEventListener('open', () => resolve({
      send(method, params = {}, sessionId) {
        return new Promise((ok, fail) => {
          id += 1;
          waiting.set(id, { ok, fail });
          ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
      },
      on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      close() { ws.close(); },
    }));
    ws.addEventListener('error', () => reject(new Error('DevTools 연결 실패')));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  if (SKIP) return;
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => { if (String(d).includes('http://')) resolve(); });
    server.on('error', reject);
  });
  profile = mkdtempSync(path.join(tmpdir(), 'hf-chrome-'));
  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', `--user-data-dir=${profile}`, '--remote-debugging-port=0',
    // CI(우분투 러너)는 사용자 네임스페이스 제한으로 샌드박스가 안 뜰 수 있다. 우리 페이지만 여는 시험이라 끈다
    ...(process.env.CI ? ['--no-sandbox'] : []),
    'about:blank',
  ]);
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome 이 DevTools 주소를 알려 주지 않음')), 15000);
    chrome.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    chrome.on('error', reject);
  });
  cdp = await connect(wsUrl);
});

after(async () => {
  cdp?.close();
  chrome?.kill();
  server?.kill();
  if (profile) {
    // Windows 는 Chrome 이 파일을 놓을 때까지 조금 걸린다
    for (let i = 0; i < 10; i++) {
      try { rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(300); }
    }
  }
});

/**
 * 새 탭에서 페이지를 열고 setup 뒤 run 스크립트를 돌린다.
 * @returns {{ errors: string[], result }} 콘솔 에러·예외·실패한 요청
 */
async function openPage(hash, { mobile = false, script }) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];
  const off = cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') errors.push(`예외: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`로그: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
  });
  const send = (m, p) => cdp.send(m, p, sessionId);
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  if (mobile) {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  } else {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  }
  await send('Page.navigate', { url: `${BASE}#${hash}` });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  // 게임이 뜨고 시뮬레이션이 돌 때까지
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    await sleep(100);
    ready = await evaluate('Boolean(window.__game && window.__game.world.tick > 20)').catch(() => false);
  }
  const fatal = await evaluate("document.getElementById('stage-msg').hidden ? null : document.getElementById('stage-msg').textContent");
  const result = ready ? await evaluate(`(async () => { ${script} })()`) : null;
  await sleep(300);
  off();
  await cdp.send('Target.closeTarget', { targetId });
  return { ready, fatal, errors, result };
}

// 메뉴를 하나씩 열어 보고, 몇 초 돌린 뒤 기계·벨트를 지어 보고, 상태를 돌려준다
const PLAY = `
  const g = window.__game;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const name of ['orders', 'recipes', 'build', 'stats', 'settings']) {
    document.querySelector('[data-panel="' + name + '"]').click();
    await wait(150);
  }
  document.querySelector('.panel:not([hidden]) [data-close]')?.click();
  const { placeMachine } = await import('./js/sim/build.js');
  g.world.parts = { iron_plate: 50, gear: 20, heat_plate: 5 };
  const built = [placeMachine(g.world, g.rules, 'grill', 3, 9, 0).ok, placeMachine(g.world, g.rules, 'belt', 3, 10, 0).ok];
  const t0 = g.world.tick;
  await wait(600);
  return { built, ticking: g.world.tick > t0, stations: g.world.stations.length, canvas: document.getElementById('game').width > 0 };
`;

test('PC 화면: 콘솔 에러 없이 뜨고, 메뉴를 열고 기계를 지을 수 있다', { skip: SKIP, timeout: 60000 }, async () => {
  const r = await openPage('debug,unlock', { script: PLAY });
  assert.equal(r.fatal, null, `시작 실패: ${r.fatal}`);
  assert.ok(r.ready, '게임이 뜨지 않음');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.result.built, [true, true]);
  assert.ok(r.result.ticking && r.result.canvas);
});

test('모바일 화면 (390×844, 터치): 콘솔 에러 없이 뜬다', { skip: SKIP, timeout: 60000 }, async () => {
  const r = await openPage('debug,unlock,touch', { mobile: true, script: PLAY });
  assert.equal(r.fatal, null, `시작 실패: ${r.fatal}`);
  assert.ok(r.ready, '게임이 뜨지 않음');
  assert.deepEqual(r.errors, []);
  assert.ok(r.result.ticking);
});
