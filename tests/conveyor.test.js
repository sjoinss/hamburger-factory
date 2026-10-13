// M3: 컨베이어, 투입기, 분배기/합류기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine, removeMachine, rotateStation } from '../public/js/sim/build.js';
import { SPACING, insertSorted, makeBeltItem } from '../public/js/sim/conveyor.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { isSolid } from '../public/js/sim/grid.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const BELT_SPEED = rules.machines.belt.speed;
const R = 0, D = 1, L = 2, U = 3; // 방향: 오른쪽, 아래, 왼쪽, 위

function run(world, input, ticks) {
  for (let i = 0; i < ticks; i++) stepWorld(world, { ...NO_INPUT, ...input }, dt, rules);
}
const secs = (s) => Math.ceil(s / dt);
function standAt(world, x, y, dir) {
  Object.assign(world.player, { x: x + 0.5, y: y + 0.5, prevX: x + 0.5, prevY: y + 0.5, dir });
}
const press = (w) => run(w, { interactPressed: true, interactHeld: true }, 1);

/** 컨베이어 단계까지 연 세상. 플레이어는 방해되지 않게 구석으로. */
function conveyorWorld() {
  const w = createWorld(rules);
  w.stats.sold.burger = 3;
  run(w, {}, 1);
  standAt(w, 15, 1, 'down');
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}
function line(w, x0, y, n, rot) {
  return Array.from({ length: n }, (_, i) => build(w, 'belt', x0 + i, y, rot));
}
const put = (belt, item, pos) => insertSorted(belt.items, makeBeltItem(belt, item, pos));
const allItems = (belts) => belts.flatMap((b) => b.items);

test('햄버거 3개를 팔면 컨베이어류 해금 + 부품', () => {
  const w = conveyorWorld();
  for (const id of ['belt', 'inserter', 'splitter', 'merger']) assert.ok(w.unlocked.machines.includes(id));
  assert.equal(w.parts.gear, 10);
  assert.equal(w.tutorial.track, 'conveyor');
});

test('벨트는 설정 속도로 물건을 옮기고 다음 벨트로 넘긴다', () => {
  const w = conveyorWorld();
  const belts = line(w, 3, 10, 4, R);
  put(belts[0], 'patty', 0);
  run(w, {}, secs(1));
  const it = belts[1].items[0];
  assert.ok(it, '1초 뒤 둘째 칸');
  assert.ok(Math.abs(it.pos - (BELT_SPEED - 1)) < 0.06, `pos=${it.pos}`);
  run(w, {}, secs(10));
  assert.equal(belts[3].items.length, 1);
  assert.equal(belts[3].items[0].pos, 1, '끝에서 멈춰 기다린다');
});

test('끝이 막히면 뒤로 쌓인다: 칸마다 최대 3개, 간격 유지', () => {
  const w = conveyorWorld();
  const belts = line(w, 3, 10, 3, R);
  for (let i = 0; i < secs(20); i++) {
    if (belts[0].items.every((it) => it.pos >= SPACING)) put(belts[0], 'patty', 0);
    run(w, {}, 1);
  }
  for (const b of belts) {
    assert.ok(b.items.length <= 3, `칸당 ${b.items.length}개`);
    for (let i = 1; i < b.items.length; i++) {
      assert.ok(b.items[i - 1].pos - b.items[i].pos >= SPACING - 1e-6, '간격');
    }
  }
  assert.equal(belts[2].items.length, 3, '맨 끝 칸이 꽉 참');
  assert.equal(belts[2].items[0].pos, 1);
  const before = allItems(belts).map((it) => it.pos);
  run(w, {}, secs(2));
  assert.deepEqual(allItems(belts).map((it) => it.pos), before, '막힌 줄은 움직이지 않는다');
});

test('투입기: 그릴 → 벨트 → 투입기 → 조립대 (손 안 대고)', () => {
  const w = conveyorWorld();
  const grill = build(w, 'grill', 8, 8);
  build(w, 'inserter', 9, 8, R);
  build(w, 'belt', 10, 8, R);
  build(w, 'belt', 11, 8, U);
  build(w, 'belt', 11, 7, U);
  build(w, 'inserter', 11, 6, U);
  const table = stationAt(w, 11, 5);

  grill.contents = ['ground_meat', 'ground_meat'];
  run(w, {}, secs(20));
  assert.deepEqual(table.contents, ['patty'], '조립대가 패티 하나만 받는다 (레시피에 하나 필요)');
  assert.equal(w.tutorial.log['fed:belt'], true);
  assert.equal(w.tutorial.log['fed:assembly_table'], true);
  // 두 번째 패티는 조립대가 받지 않으니 벨트 끝에서 기다린다
  const waiting = stationAt(w, 11, 7).items;
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0].item, 'patty');
  assert.equal(stationAt(w, 11, 6).status, 'idle', '받을 수 없는 물건은 집지 않는다');
});

test('투입기는 앞 칸이 받지 않는 물건을 집지 않는다', () => {
  const w = conveyorWorld();
  const belt = build(w, 'belt', 9, 9, R);
  build(w, 'inserter', 10, 9, R);
  const grill = build(w, 'grill', 11, 9);
  put(belt, 'bun', 1);
  run(w, {}, secs(3));
  assert.equal(belt.items.length, 1, '번은 그릴에 넣을 수 없으니 그대로');
  assert.deepEqual(grill.contents, []);
});

test('투입기로 출고구에 넣으면 팔린다', () => {
  const w = conveyorWorld();
  const belt = build(w, 'belt', 7, 10, D);
  build(w, 'inserter', 7, 11, D);
  put(belt, 'patty', 1);
  run(w, {}, secs(3));
  assert.equal(w.money, rules.items.patty.price);
});

test('분배기는 왼쪽·오른쪽으로 번갈아 보낸다', () => {
  const w = conveyorWorld();
  const feed = build(w, 'belt', 9, 9, R);
  build(w, 'splitter', 10, 9, R);
  const up = build(w, 'belt', 10, 8, U); // 오른쪽을 보는 분배기의 왼쪽 = 위
  const down = build(w, 'belt', 10, 10, D);
  for (let i = 0; i < 4; i++) {
    put(feed, 'patty', 0);
    run(w, {}, secs(1.2));
  }
  run(w, {}, secs(3));
  assert.equal(up.items.length, 2);
  assert.equal(down.items.length, 2);
});

test('분배기: 한쪽이 막히면 다른 쪽으로', () => {
  const w = conveyorWorld();
  const feed = build(w, 'belt', 9, 9, R);
  build(w, 'splitter', 10, 9, R);
  const down = build(w, 'belt', 10, 10, D);
  // 위쪽 출구 없음
  for (let i = 0; i < 3; i++) {
    put(feed, 'patty', 0);
    run(w, {}, secs(1.2));
  }
  run(w, {}, secs(3));
  assert.equal(down.items.length, 3);
});

test('합류기는 두 줄을 번갈아 받아 한 줄로', () => {
  const w = conveyorWorld();
  const a = line(w, 6, 9, 3, R); // 왼쪽에서
  const b = build(w, 'belt', 9, 8, D); // 위에서
  build(w, 'merger', 9, 9, R);
  const out = line(w, 10, 9, 4, R);
  for (let i = 0; i < 6; i++) {
    if (a[0].items.every((it) => it.pos >= SPACING)) put(a[0], 'patty', 0);
    if (b.items.every((it) => it.pos >= SPACING)) put(b, 'bun', 0);
    run(w, {}, secs(0.7));
  }
  run(w, {}, secs(6));
  const kinds = allItems(out).map((it) => it.item);
  assert.ok(kinds.includes('patty') && kinds.includes('bun'), kinds.join(','));
  assert.ok(Math.abs(kinds.filter((k) => k === 'patty').length - kinds.filter((k) => k === 'bun').length) <= 1, '공평하게');
});

test('플레이어: 벨트 위를 걸어 다니고, E 로 집고 Q 로 올린다', () => {
  const w = conveyorWorld();
  const belt = build(w, 'belt', 10, 9, R);
  assert.ok(!isSolid(w.grid, 10, 9), '밟고 지나갈 수 있다');
  assert.ok(isSolid(w.grid, build(w, 'inserter', 12, 9, R).x, 9), '투입기는 막힌다');

  standAt(w, 9, 9, 'right');
  w.player.inventory = ['patty', null];
  run(w, { dropPressed: true }, 1);
  assert.equal(belt.items.length, 1, 'Q: 벨트 위에 올린다');
  assert.deepEqual(w.groundItems, []);
  run(w, {}, secs(1));
  press(w);
  assert.deepEqual(w.player.inventory, ['patty', null], 'E: 집는다');
});

test('끌어서 깐 벨트는 방향을 바꿀 수 있고, 철거하면 위 물건은 손으로', () => {
  const w = conveyorWorld();
  const belt = build(w, 'belt', 10, 9, R);
  assert.ok(rotateStation(w, rules, belt, D));
  assert.equal(belt.rot, D);
  put(belt, 'patty', 0.5);
  const res = removeMachine(w, rules, 10, 9);
  assert.ok(res.ok);
  assert.deepEqual(w.player.inventory, ['patty', null]);
});

test('벨트가 돌아가는 상태도 JSON 직렬화 가능', () => {
  const w = conveyorWorld();
  const belts = line(w, 3, 10, 3, R);
  put(belts[0], 'patty', 0);
  run(w, {}, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
});
