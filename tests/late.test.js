// 후반 콘텐츠: 남쪽 구역(2D 맵), 기계 업그레이드, 고속 벨트, 급한 주문, 엔딩 뒤 도전과 기록
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine, removeMachine } from '../public/js/sim/build.js';
import { buyZone, checkZone, ownedBounds, zoneSpeed } from '../public/js/sim/zones.js';
import { checkUpgrade, upgradeStation, speedMult } from '../public/js/sim/upgrade.js';
import { TILE, getTile, isSolid } from '../public/js/sim/grid.js';
import { challengeAt, currentChallenge, updateChapters } from '../public/js/sim/chapters.js';
import { record, recordEarned } from '../public/js/sim/stats.js';
import { updateOrders } from '../public/js/sim/orders.js';
import { serializeWorld, loadWorld } from '../public/js/sim/save.js';
import { validateZones } from '../public/js/data.js';
import { loadRules, readData } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };
const zone = (id) => rules.zones.zones.find((z) => z.id === id);
const R = 0;

function worldAt(burgers) {
  const w = createWorld(rules);
  w.stats.sold.burger = burgers;
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 11.5, prevX: 15.5, prevY: 11.5 });
  w.orders.timer = 1e9;
  w.parts = { iron_plate: 500, gear: 200, heat_plate: 50, wire: 100, motor: 50, sensor: 20, circuit: 20 };
  w.money = 100000;
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}

test('맵: 남쪽 구역은 창고동 아래로 붙고, 길은 시작 방 아래에만', () => {
  const w = createWorld(rules);
  const s1 = zone('south1');
  assert.equal(getTile(w.grid, s1.x + 2, s1.y + 2), TILE.LOCKED);
  assert.equal(getTile(w.grid, 5, 14), TILE.STREET, '가게 앞 길');
  assert.equal(getTile(w.grid, s1.x - 1, s1.y), TILE.WALL, '길 끝은 구역 벽');
  assert.equal(getTile(w.grid, 5, w.grid.height - 1), TILE.VOID, '시작 방 아래 먼 곳은 빈 땅');
  assert.ok(isSolid(w.grid, 5, w.grid.height - 1));
  // 출고구 창구는 그대로
  assert.equal(getTile(w.grid, 7, 13), TILE.WINDOW);
});

test('남쪽 구역: 앞 구역을 사야 살 수 있고, 사면 맞닿은 벽이 모두 트인다', () => {
  const w = worldAt(25);
  assert.equal(checkZone(w, rules, 'south1').reason, 'requires');
  assert.ok(buyZone(w, rules, 'east1').ok);
  const before = ownedBounds(w, rules);
  assert.ok(buyZone(w, rules, 'south1').ok);
  const s1 = zone('south1');
  assert.equal(getTile(w.grid, s1.x + 3, s1.y + 3), TILE.FLOOR);
  assert.equal(getTile(w.grid, s1.x + 3, s1.y - 1), TILE.FLOOR, '창고동과 사이 벽이 트임');
  assert.equal(getTile(w.grid, s1.x - 1, s1.y + 5), TILE.WALL, '왼쪽 (길 쪽)은 벽 그대로');
  assert.ok(ownedBounds(w, rules).h > before.h, '카메라가 아래로 갈 수 있다');

  // 순서와 상관없이: 발전동을 나중에 사도 공방동과 사이 벽이 트인다
  assert.ok(buyZone(w, rules, 'south2').ok);
  const s2 = zone('south2');
  assert.equal(getTile(w.grid, s2.x + 3, s2.y - 1), TILE.WALL, '발전동은 아직 안 삼');
  assert.ok(buyZone(w, rules, 'east2').ok);
  assert.equal(getTile(w.grid, s2.x + 3, s2.y - 1), TILE.FLOOR);

  // 저장 후 불러와도 같은 모양
  const { world: back } = loadWorld(rules, serializeWorld(w));
  for (const [x, y] of [[s1.x + 3, s1.y - 1], [s2.x + 3, s2.y - 1], [s2.x - 1, s2.y + 3]]) {
    assert.equal(getTile(back.grid, x, y), getTile(w.grid, x, y), `${x},${y}`);
  }
});

test('주방동: 조리 기계만 빨라진다', () => {
  const w = worldAt(25);
  buyZone(w, rules, 'east1');
  buyZone(w, rules, 'south1');
  const s1 = zone('south1');
  const inZone = build(w, 'grill', s1.x + 2, s1.y + 2);
  const home = build(w, 'grill', 3, 9);
  const cutter = build(w, 'meat_cutter', s1.x + 4, s1.y + 2);
  assert.equal(zoneSpeed(w, rules, inZone), s1.trait.mult);
  assert.equal(zoneSpeed(w, rules, home), 1);
  assert.equal(zoneSpeed(w, rules, cutter), 1, '목록에 없는 기계');
  inZone.contents.push('ground_meat');
  home.contents.push('ground_meat');
  const seconds = rules.recipes.find((r) => r.id === 'fry_patty').seconds;
  run(w, secs(seconds / s1.trait.mult + 0.1));
  assert.deepEqual(inZone.output, ['patty']);
  assert.deepEqual(home.output, []);
});

test('햄버거 100개: 업그레이드·고속 벨트·급한 주문이 열린다', () => {
  const pre = worldAt(99);
  const g = build(pre, 'grill', 3, 9);
  assert.equal(checkUpgrade(pre, rules, g).reason, 'locked');
  const w = worldAt(100);
  assert.ok(w.features.includes('upgrades') && w.features.includes('rush'));
  assert.ok(w.unlocked.machines.includes('fast_belt'));
});

test('업그레이드: 돈 + 부품, 등급마다 빨라지고 전기를 더 쓴다. 철거하면 부품은 돌려준다', () => {
  const w = worldAt(100);
  const up = rules.game.upgrades;
  const grill = build(w, 'grill', 3, 9);
  const table = w.stations.find((s) => s.type === 'cutting_board');
  assert.equal(checkUpgrade(w, rules, table).reason, 'kind', '처음 작업대는 못 올린다');

  w.money = up.costs[0].money - 1;
  assert.equal(checkUpgrade(w, rules, grill).reason, 'money');
  w.money = 100000;
  const gears = w.parts.gear;
  assert.ok(upgradeStation(w, rules, grill).ok);
  assert.equal(grill.level, 1);
  assert.equal(w.money, 100000 - up.costs[0].money);
  assert.equal(w.parts.gear, gears - up.costs[0].parts.gear);
  assert.equal(speedMult(w, rules, grill), 1 + up.speedPerLevel);
  while (checkUpgrade(w, rules, grill).ok) upgradeStation(w, rules, grill);
  assert.equal(grill.level, up.costs.length);
  assert.equal(checkUpgrade(w, rules, grill).reason, 'max');

  // 전기: 돌아가는 동안 등급만큼 더 쓴다
  grill.contents.push('ground_meat', 'ground_meat');
  run(w, 2);
  const expected = rules.machines.grill.power * (1 + up.powerPerLevel * grill.level);
  assert.ok(Math.abs(w.power.demand - expected) < 1e-9, `${w.power.demand} vs ${expected}`);

  // 저장해도 등급 유지
  const { world: back } = loadWorld(rules, serializeWorld(w));
  assert.equal(back.stations.find((s) => s.id === grill.id).level, grill.level);

  // 철거: 기계 부품 + 업그레이드 부품
  grill.contents = [];
  grill.output = [];
  const motors = w.parts.motor;
  const spentMotors = up.costs.reduce((a, c) => a + (c.parts.motor ?? 0), 0);
  assert.ok(removeMachine(w, rules, 3, 9).ok);
  assert.equal(w.parts.motor, motors + spentMotors);
});

test('고속 벨트: 일반 벨트 위에 깔면 그 자리에서 바뀌고 물건은 그대로, 두 배로 빠르다', () => {
  const w = worldAt(100);
  const slow = build(w, 'belt', 3, 9, R);
  slow.items.push({ item: 'patty', pos: 0.2, x: 3.2, y: 9.5, px: 3.2, py: 9.5, tag: null, bag: null });
  const plates = w.parts.iron_plate;
  const res = placeMachine(w, rules, 'fast_belt', 3, 9, R);
  assert.ok(res.ok);
  assert.equal(res.station, slow, '같은 기계를 바꾼다');
  assert.equal(slow.type, 'fast_belt');
  assert.equal(slow.items.length, 1);
  assert.equal(w.parts.iron_plate, plates - rules.machines.fast_belt.cost.iron_plate + rules.machines.belt.cost.iron_plate);
  assert.equal(placeMachine(w, rules, 'fast_belt', 3, 9, R).reason, 'blocked', '같은 종류는 못 덮는다');

  // 속도 비교: 같은 길이를 지나는 시간
  const fast = build(w, 'fast_belt', 3, 10, R);
  const normal = build(w, 'belt', 3, 11, R);
  fast.items = [{ item: 'patty', pos: 0, x: 3, y: 10.5, px: 3, py: 10.5, tag: null, bag: null }];
  normal.items = [{ item: 'patty', pos: 0, x: 3, y: 11.5, px: 3, py: 11.5, tag: null, bag: null }];
  run(w, 4);
  assert.ok(fast.items[0].pos > normal.items[0].pos * 1.9, `${fast.items[0].pos} vs ${normal.items[0].pos}`);
});

test('급한 주문: 기능이 열린 뒤에만 오고, 시간이 짧고 보상이 크다', () => {
  const kinds = (w) => {
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      w.orders.list = [];
      w.orders.timer = 0;
      updateOrders(w, rules, dt);
      for (const o of w.orders.list) seen.add(o.kind);
    }
    return seen;
  };
  const pre = worldAt(99);
  assert.ok(!kinds(pre).has('rush'));
  const w = worldAt(100);
  assert.ok(kinds(w).has('rush'));
  const rush = rules.orders.kinds.rush;
  assert.ok(rush.deadline < rules.orders.kinds.special.deadline);
  assert.ok(rush.rewardMul[0] > rules.orders.kinds.special.rewardMul[0]);
});

test('엔딩 뒤 도전: 단계마다 목표가 오르고, 채우면 보상 (1초에 한 단계씩)', () => {
  const a = challengeAt(rules, 1);
  const b = challengeAt(rules, 2);
  const lap = challengeAt(rules, rules.challenge.rates.length + 1);
  assert.ok(b.goals[0].n > a.goals[0].n, '분당 수익 목표가 오른다');
  assert.notEqual(a.goals[1].item, b.goals[1].item, '판매 품목이 돌아간다');
  assert.equal(lap.goals[1].item, a.goals[1].item);
  assert.ok(lap.goals[1].n > a.goals[1].n, '한 바퀴 돌면 더 많이');
  assert.ok(b.reward.money > a.reward.money);

  const w = createWorld(rules);
  assert.equal(currentChallenge(w, rules), null, '엔딩 전에는 없다');
  w.chapters = { index: rules.chapters.length, ended: true, endedAt: 0, challenge: 0 };
  w.time = 120;
  recordEarned(w, 1e6);
  record(w, 'sold', 'burger', 1000);
  record(w, 'sold', 'pizza', 1000);
  const money = w.money;
  updateChapters(w, rules);
  assert.equal(w.chapters.challenge, 1);
  assert.equal(w.money - money, a.reward.money);
  updateChapters(w, rules);
  assert.equal(w.chapters.challenge, 2, '다음 단계도 이미 넘었으면 다음 초에');
  assert.ok(w.events.some((e) => e.type === 'challengeDone' && e.level === 2));

  // 기록: 1분이 지난 뒤의 최고값, 저장해도 남는다
  assert.ok(w.records.earnRate >= 1e6);
  assert.ok(w.records.rate.burger >= 1000);
  const { world: back } = loadWorld(rules, serializeWorld(w));
  assert.equal(back.chapters.challenge, 2);
  assert.deepEqual(back.records, w.records);
});

test('구역 데이터: 겹치거나 앞 구역과 떨어진 구역은 거절', () => {
  const raw = readData('zones');
  const items = rules.items;
  const bad = (patch) => {
    const data = structuredClone(raw);
    Object.assign(data.zones.find((z) => z.id === 'south1'), patch);
    return () => validateZones(data, items, rules.game, rules.machines);
  };
  assert.doesNotThrow(bad({}));
  assert.throws(bad({ y: 10 }), /겹침/);
  assert.throws(bad({ y: 15 }), /맞닿아야/);
  assert.throws(bad({ x: 1, y: 16 }), /맞닿아야|길/);
});
