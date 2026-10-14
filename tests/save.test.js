// 저장 형식 변환과 부팅 때 저장 읽기 (망가진 저장 보관, 되살리기)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../public/js/sim/world.js';
import { serializeWorld, loadWorld, migrateSave, SAVE_VERSION } from '../public/js/sim/save.js';
import { readSavedGame } from '../public/js/ui/settings.js';
import { loadRules } from './helpers.js';

const rules = loadRules();

test('저장 변환: 한 단계씩 차례로, 빠진 단계가 있으면 거절', () => {
  const steps = {
    1: (w) => ({ ...w, moneyV2: w.money }),
    2: (w) => ({ ...w, moneyV3: w.moneyV2 * 2 }),
  };
  const out = migrateSave({ version: 1, world: { money: 5 } }, steps, 3);
  assert.equal(out.version, 3);
  assert.equal(out.world.moneyV3, 10);
  assert.throws(() => migrateSave({ version: 1, world: {} }, { 1: (w) => w }, 3), /버전 2/);
  assert.throws(() => migrateSave({ version: 1, world: {} }, { 1: () => null }, 2), /변환 실패/);
  // 지금 버전은 그대로
  const same = { version: SAVE_VERSION, world: { a: 1 } };
  assert.deepEqual(migrateSave(same), same);
});

test('더 새 버전에서 만든 저장은 읽지 않는다 (덮어쓰지 않게 알려 준다)', () => {
  const data = JSON.parse(serializeWorld(createWorld(rules)));
  data.version = SAVE_VERSION + 1;
  assert.throws(() => loadWorld(rules, JSON.stringify(data)), /더 새 버전/);
  assert.equal(loadWorld(rules, serializeWorld(createWorld(rules))).migratedFrom, null);
});

/** 브라우저 저장소 흉내 */
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
  return m;
}

test('부팅: 못 읽는 저장은 지우지 않고 옮겨 두고, 나중에 읽을 수 있게 되면 되살린다', () => {
  const KEY = 'hamburger-factory:save';
  const BROKEN = 'hamburger-factory:save-broken';
  const w = createWorld(rules);
  w.money = 777;
  const good = serializeWorld(w, 2000);

  let store = fakeStorage({ [KEY]: '{"format":"nope"}' });
  const res = readSavedGame(rules);
  assert.match(res.error, /새로 시작/);
  assert.equal(store.get(BROKEN), '{"format":"nope"}', '원본은 보관');
  assert.ok(!store.has(KEY));

  // 옮겨 둔 저장이 지금은 읽히고 더 최근 것이면 그쪽으로
  const fresh = serializeWorld(createWorld(rules), 1000);
  store = fakeStorage({ [KEY]: fresh, [BROKEN]: good });
  const back = readSavedGame(rules);
  assert.ok(back.recovered);
  assert.equal(back.world.money, 777);
  assert.equal(store.get(KEY), good);
  assert.ok(!store.has(BROKEN));

  // 옮겨 둔 저장이 더 오래됐으면 지금 저장 그대로
  store = fakeStorage({ [KEY]: good, [BROKEN]: fresh });
  const keep = readSavedGame(rules);
  assert.ok(!keep.recovered);
  assert.equal(keep.world.money, 777);
  delete globalThis.localStorage;
});
