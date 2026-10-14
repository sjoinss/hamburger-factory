// M7: 주문 인식기, 합류 포장기, 청사진, 저장/불러오기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { setGateManual, gateFront } from '../public/js/sim/gate.js';
import { openOrders } from '../public/js/sim/orders.js';
import { insertSorted, makeBeltItem } from '../public/js/sim/conveyor.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { captureBlueprint, checkBlueprint, pasteBlueprint, validateBlueprint, blueprintCost, rotateBlueprint } from '../public/js/sim/blueprint.js';
import { serializeWorld, loadWorld, replaceWorld } from '../public/js/sim/save.js';
import { buyZone } from '../public/js/sim/zones.js';
import { setSupplyItem } from '../public/js/sim/station.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const R = 0, D = 1;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };

function autoWorld() {
  const w = createWorld(rules);
  w.stats.sold.burger = 60;
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 10.5, prevX: 15.5, prevY: 10.5 });
  w.chapters.ended = true; // 챕터 보상이 돈 계산에 끼지 않게
  w.orders.timer = 1e9;
  w.parts = { ...w.parts, iron_plate: 500, gear: 200, heat_plate: 50, wire: 100, motor: 50, sensor: 20, circuit: 20 };
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}
function addOrder(w, items, kind = 'normal', reward = 100, deadline = null) {
  const order = {
    id: w.orders.nextId++, kind, items, delivered: {}, reward, createdAt: w.time,
    deadline, state: 'open', leaveAt: null, look: { hair: 0, shirt: 0, seed: 1 },
  };
  w.orders.list.push(order);
  return order;
}
/** 호퍼 (7,9) 2x2 + 그 아래 게이트 (7,11) → 출고구 (7,12), 오른쪽에 인식기 (9,10) */
function readerLine(w) {
  const hopper = build(w, 'hopper', 7, 9);
  const gate = build(w, 'gate', 7, 11, D);
  const reader = build(w, 'order_reader', 9, 10);
  return { hopper, gate, reader };
}

test('햄버거 60개: 완전 자동화 단계 (주문 인식기·합류 포장기, 센서·제어 회로)', () => {
  const w = autoWorld();
  assert.ok(w.unlocked.machines.includes('order_reader') && w.unlocked.machines.includes('bundler'));
  assert.ok(w.unlocked.recipes.includes('make_sensor') && w.unlocked.recipes.includes('make_circuit'));
  assert.equal(w.tutorial.track, 'auto');
  // 단계 보상만으로 인식기 하나는 지을 수 있다
  const fresh = createWorld(rules);
  fresh.stats.sold.burger = 60;
  run(fresh, 1);
  for (const [id, n] of Object.entries(rules.machines.order_reader.cost)) assert.ok((fresh.parts[id] ?? 0) >= n, id);
});

test('부품 조립기: 센서·제어 회로', () => {
  const w = autoWorld();
  const pa = build(w, 'part_assembler', 3, 3);
  // 철선이 없어야 열판·모터 레시피와 헷갈리지 않는다
  pa.contents.push('iron_plate', 'iron_plate', 'gear');
  run(w, secs(4.1));
  assert.deepEqual(pa.output, ['sensor']);
  pa.output = [];
  pa.contents.push('motor', 'wire', 'wire', 'heat_plate');
  run(w, secs(6.1));
  assert.deepEqual(pa.output, ['circuit']);
});

test('주문 인식기: 가만히 있어도 재고가 되는 주문을 게이트에 맡겨 처리한다 (남은 시간이 짧은 주문 먼저)', () => {
  const w = autoWorld();
  const { hopper, gate, reader } = readerLine(w);
  hopper.stock = { burger: 6, patty: 2 };
  const cant = addOrder(w, { fries: 1 }, 'normal', 10); // 재고 없음: 맡기지 않는다
  const slow = addOrder(w, { burger: 2 }, 'normal', 30);
  const urgent = addOrder(w, { burger: 1, patty: 2 }, 'normal', 50, w.time + 60);
  const money0 = w.money;
  run(w, secs(2));
  assert.equal(gate.mode.kind, 'order');
  assert.equal(gate.mode.orderId, urgent.id, '시한 있는 주문 먼저');
  assert.ok(gate.mode.auto);
  run(w, secs(10));
  assert.equal(urgent.state, 'done');
  assert.equal(slow.state, 'done');
  assert.equal(cant.state, 'open');
  assert.equal(w.money - money0, 80);
  assert.deepEqual(hopper.stock, { burger: 3 });
  assert.equal(reader.reason, 'no-stock');
  assert.equal(w.tutorial.log['order:auto'], true);
});

test('인식기는 사람이 정한 수동 게이트를 건드리지 않는다', () => {
  const w = autoWorld();
  const { hopper, gate, reader } = readerLine(w);
  hopper.stock = { burger: 10 };
  setGateManual(gate, 'patty', 5, false); // 패티가 없어서 멈춰 있는 수동 게이트
  addOrder(w, { burger: 1 });
  run(w, secs(3));
  assert.equal(gate.mode.kind, 'manual');
  assert.equal(gate.mode.item, 'patty');
  assert.notEqual(reader.reason, 'assigned');
});

test('게이트가 없으면 인식기는 대기', () => {
  const w = autoWorld();
  const reader = build(w, 'order_reader', 9, 7);
  addOrder(w, { burger: 1 });
  run(w, secs(2));
  assert.equal(reader.reason, 'no-gate');
  assert.equal(reader.status, 'idle');
});

/** 호퍼 (7,8) + 게이트 (7,10) ↓ (셔터는 오른쪽 칸) + 합류 포장기 (8,11) ↓ → 출고구 (8,12) */
function bundleLine(w) {
  const hopper = build(w, 'hopper', 7, 8);
  const gate = build(w, 'gate', 7, 10, D);
  const bundler = build(w, 'bundler', 8, 11, D);
  return { hopper, gate, bundler };
}

test('합류 포장기: 주문 하나를 한 묶음으로 납품, 보상에 묶음 보너스', () => {
  const w = autoWorld();
  const { hopper, gate, bundler } = bundleLine(w);
  build(w, 'order_reader', 9, 9);
  hopper.stock = { burger: 2, fries: 1, cola: 1 };
  const o = addOrder(w, { burger: 2, fries: 1, cola: 1 }, 'normal', 40);
  const money0 = w.money;
  let maxDelivered = 0;
  for (let i = 0; i < secs(10); i++) {
    run(w, 1);
    // 묶음이 나가기 전에는 하나도 납품되지 않는다
    if (o.state === 'open') maxDelivered = Math.max(maxDelivered, ...Object.values(o.delivered), 0);
  }
  assert.equal(maxDelivered, 0);
  assert.equal(o.state, 'done');
  assert.equal(w.money - money0, Math.round(40 * rules.orders.bundleBonus));
  assert.equal(w.tutorial.log['order:bundle'], true);
  assert.equal(Object.keys(bundler.packs).length, 0);
  assert.equal(gate.status === 'running' || gate.status === 'idle', true);
});

test('합류 포장기: 번호표 없는 물건은 그대로 통과 (시세 판매)', () => {
  const w = autoWorld();
  const { hopper, gate } = bundleLine(w);
  hopper.stock = { burger: 3 };
  setGateManual(gate, 'burger', 3, false);
  const sold0 = w.stats.sold.burger;
  run(w, secs(5));
  assert.equal(w.stats.sold.burger - sold0, 3);
});

test('합류 포장기: 주문이 시간 초과되면 모으던 물건을 풀어서 내보낸다', () => {
  const w = autoWorld();
  const { bundler } = bundleLine(w);
  const o = addOrder(w, { burger: 3 }, 'normal', 90, w.time + 1);
  const belt = build(w, 'belt', 7, 11, R); // 왼쪽에서 포장기로
  insertSorted(belt.items, { ...makeBeltItem(belt, 'burger', 1), tag: o.id });
  run(w, secs(0.5));
  assert.deepEqual(bundler.packs[o.id], { burger: 1 });
  const sold0 = w.stats.sold.burger;
  run(w, secs(3));
  assert.equal(o.state, 'failed');
  assert.equal(Object.keys(bundler.packs).length, 0);
  assert.equal(w.stats.sold.burger - sold0, 1, '풀린 버거는 시세로 팔렸다');
});

test('주문 묶음은 투입기·손으로 집지 않고, 호퍼에 들어가지 않는다', () => {
  const w = autoWorld();
  const belt = build(w, 'belt', 3, 9, 3); // 위로: 앞이 빈 바닥이라 끝에서 대기
  build(w, 'inserter', 4, 9, R); // 벨트(3,9) → 오른쪽 호퍼(5,9)
  const hopper = build(w, 'hopper', 5, 9);
  insertSorted(belt.items, { ...makeBeltItem(belt, 'order_bag', 0.5), tag: 99, bag: { burger: 1 } });
  run(w, secs(3));
  assert.equal(belt.items.length, 1);
  assert.equal(Object.keys(hopper.stock).length, 0);
});

test('청사진: 영역을 저장해 다른 곳에 똑같이 짓는다 (설정 포함, 부품은 합계로 확인)', () => {
  const w = autoWorld();
  const sup = build(w, 'supply', 3, 3);
  setSupplyItem(rules, sup, 'iron_ore', w);
  build(w, 'inserter', 4, 3, R);
  build(w, 'smelter', 5, 3);
  build(w, 'belt', 6, 3, R);
  const hop = build(w, 'hopper', 7, 3);
  hop.filter = 'iron_ingot';
  const bp = captureBlueprint(w, rules, 2, 2, 9, 5);
  assert.equal(bp.entries.length, 5);
  assert.deepEqual([bp.w, bp.h], [6, 2]);

  // 시작 작업대와 겹치는 자리 → 불가
  assert.equal(checkBlueprint(w, rules, bp, 3, 2).reason, 'blocked');
  const before = w.stations.length;
  const res = pasteBlueprint(w, rules, bp, 3, 8);
  assert.ok(res.ok, res.reason);
  assert.equal(w.stations.length, before + 5);
  assert.equal(stationAt(w, 3, 8).item, 'iron_ore');
  assert.equal(stationAt(w, 7, 8).filter, 'iron_ingot');
  assert.equal(w.tutorial.log['ui:blueprint'], true);

  // 부품이 모자라면 아무것도 짓지 않는다
  w.parts = {};
  for (const st of w.stations) if (st.stock) st.stock = {};
  const n = w.stations.length;
  const bad = pasteBlueprint(w, rules, bp, 9, 8);
  assert.equal(bad.reason, 'parts');
  assert.equal(w.stations.length, n);
  assert.ok(Object.keys(bad.missing).length > 0);
  assert.deepEqual(Object.keys(blueprintCost(rules, bp)).sort(), ['gear', 'heat_plate', 'iron_plate']);
});

test('청사진 검증: 겹치거나 범위 밖이거나 모르는 기계면 거부', () => {
  const ok = { name: '  라인 A  ', w: 2, h: 1, entries: [{ type: 'belt', x: 0, y: 0, rot: 0 }, { type: 'belt', x: 1, y: 0, rot: 0 }] };
  assert.equal(validateBlueprint(rules, ok).name, '라인 A');
  assert.equal(validateBlueprint(rules, { ...ok, entries: [ok.entries[0], ok.entries[0]] }), null, '겹침');
  assert.equal(validateBlueprint(rules, { ...ok, w: 1 }), null, '범위 밖');
  assert.equal(validateBlueprint(rules, { ...ok, entries: [{ type: 'counter', x: 0, y: 0, rot: 0 }] }), null, '지을 수 없는 기계');
  assert.equal(validateBlueprint(rules, { ...ok, entries: [{ type: '__proto__', x: 0, y: 0, rot: 0 }] }), null);
  assert.equal(validateBlueprint(rules, { ...ok, name: '' }), null);
  assert.equal(validateBlueprint(rules, null), null);
});

test('저장 → 불러오기: 공장이 그대로 돌아온다 (같은 씨앗이면 이후도 같다)', () => {
  const w = autoWorld();
  w.money = 2000;
  assert.ok(buyZone(w, rules, 'east1').ok);
  const { hopper } = readerLine(w);
  hopper.stock = { burger: 20 };
  build(w, 'belt', 20, 5, R);
  build(w, 'bundler', 21, 5, R);
  w.orders.timer = null;
  run(w, secs(60));

  const text = serializeWorld(w);
  const { world: loaded, dropped } = loadWorld(rules, text);
  assert.equal(dropped, 0);
  assert.equal(loaded.stations.length, w.stations.length);
  assert.deepEqual(loaded.zonesBought, ['east1']);
  assert.equal(loaded.money, w.money);
  assert.deepEqual(loaded.orders, w.orders);
  for (const st of w.stations) {
    const o = stationAt(loaded, st.x, st.y);
    assert.equal(o.type, st.type);
    assert.equal(o.id, st.id);
  }
  // 이어서 돌려도 같은 결과
  run(w, secs(30));
  run(loaded, secs(30));
  assert.equal(loaded.money, w.money);
  assert.deepEqual(loaded.orders, w.orders);
  assert.deepEqual(JSON.parse(serializeWorld(loaded)), JSON.parse(serializeWorld(w)));
});

test('망가진 저장은 거부하거나, 이상한 값만 버리고 불러온다 (죽지 않는다)', () => {
  assert.throws(() => loadWorld(rules, ''), /비어/);
  assert.throws(() => loadWorld(rules, '{not json'), /JSON/);
  assert.throws(() => loadWorld(rules, '{"format":"x"}'), /아니다/);
  assert.throws(() => loadWorld(rules, JSON.stringify({ format: 'hamburger-factory-save', version: 999, world: {} })), /버전/);

  const w = autoWorld();
  build(w, 'belt', 3, 9, R);
  const data = JSON.parse(serializeWorld(w));
  const s = data.world;
  s.money = 'lots';
  s.parts = { __proto__: { iron_plate: 1 }, iron_plate: -5, gear: 3.5, burger: 10, sensor: 2 };
  s.stations.push(
    { type: 'nope', x: 3, y: 3 },
    { type: 'belt', x: 3, y: 9, rot: 0, built: true }, // 겹침
    { type: 'counter', x: 3, y: 7, built: false }, // 처음 배치가 아닌 출고구
    { type: 'belt', x: -4, y: 2, rot: 9, built: true },
    { type: 'hopper', x: 10, y: 8, rot: 0, built: true, stock: { burger: 1e9, order_bag: 3 }, filter: 'zzz' },
  );
  s.player = { x: 0, y: 0, inventory: ['burger', 'evil', 'x'] };
  s.orders = { list: [{ id: 1, kind: 'normal', items: { raw_meat: 3 } }, { id: 2, kind: 'normal', items: { burger: 2 }, state: 'open' }], nextId: -3 };
  s.tutorial = { track: 'nope', log: { 'built:grill': true, '<img>': true } };
  s.zonesBought = ['east2']; // 앞 구역 없이
  const { world: loaded, dropped } = loadWorld(rules, JSON.stringify(data));
  assert.equal(dropped, 4);
  assert.equal(loaded.money, 0);
  assert.deepEqual(loaded.parts, { sensor: 2 });
  const hop = stationAt(loaded, 10, 8);
  assert.deepEqual(hop.stock, { burger: rules.machines.hopper.capacity });
  assert.equal(hop.filter, null);
  assert.notEqual(loaded.player.x, 0, '벽 속 위치는 시작 위치로');
  assert.deepEqual(loaded.player.inventory, ['burger', null]);
  assert.deepEqual(loaded.orders.list.map((o) => o.id), [2]);
  assert.equal(loaded.orders.nextId, 3);
  assert.equal(loaded.tutorial.track, null);
  assert.deepEqual(Object.keys(loaded.tutorial.log), ['built:grill']);
  assert.deepEqual(loaded.zonesBought, []);
  // 불러온 월드도 그대로 돌아간다
  run(loaded, secs(5));
});

test('replaceWorld: 같은 객체를 유지한 채 내용만 바뀐다', () => {
  const a = autoWorld();
  const b = createWorld(rules);
  b.money = 77;
  replaceWorld(a, b);
  assert.equal(a.money, 77);
  assert.equal(a.stations, b.stations);
  run(a, 5);
});

test('완전 자동: 플레이어가 가만히 서 있어도 주문이 처리되고 돈이 쌓인다', () => {
  // 게이트 하나에 사일로(버거)와 호퍼(나머지 메뉴)를 붙이고, 인식기가 손님 주문을 알아서 맡긴다.
  const w = autoWorld();
  w.orders.timer = null; // 손님이 저절로 온다
  const { hopper } = readerLine(w);
  const silo = build(w, 'silo', 5, 9); // (5,9)-(6,11): 게이트 (7,11) 왼쪽에 붙는다
  silo.stock = { burger: 200 };
  hopper.stock = { patty: 15, fries: 15, cola: 15, set: 15 };
  const money0 = w.money;
  const rep0 = w.reputation;
  const playerAt = { x: w.player.x, y: w.player.y };
  run(w, secs(300));
  const done = w.orders.list.filter((o) => o.state === 'done').length + (w.reputation - rep0 > 0 ? 1 : 0);
  assert.ok(done > 0);
  assert.ok(w.money - money0 >= 200, `5분 동안 번 돈 ${w.money - money0}`);
  assert.ok(w.reputation > rep0, '주문을 처리해 평판이 올랐다');
  assert.ok(silo.stock.burger < 200, '사일로 버거가 나갔다');
  assert.deepEqual({ x: w.player.x, y: w.player.y }, playerAt, '플레이어는 그대로');
});

test('게이트 셔터 칸: 스프라이트의 셔터와 같은 칸에서 내보낸다', () => {
  const w = autoWorld();
  // [방향, x, y, 내보내는 칸]: 오른쪽은 위 칸, 아래는 오른쪽 칸, 왼쪽은 아래 칸, 위는 왼쪽 칸에서
  const cases = [[0, 3, 7, { x: 4, y: 7 }], [1, 5, 7, { x: 6, y: 8 }], [2, 9, 7, { x: 8, y: 8 }], [3, 11, 8, { x: 11, y: 7 }]];
  for (const [rot, x, y, want] of cases) {
    const g = build(w, 'gate', x, y, rot);
    assert.deepEqual(gateFront(g), want, `rot ${rot}`);
  }
});

test('청사진 회전: 네 번 돌리면 원래대로, 어느 방향으로 붙여넣어도 게이트 → 벨트 연결이 그대로', () => {
  const src = autoWorld();
  build(src, 'hopper', 2, 7); // (2,7)-(3,8)
  const g = build(src, 'gate', 4, 7, R); // 셔터 (4,7) → 앞 (5,7)
  setGateManual(g, 'burger', 3, false);
  build(src, 'belt', 5, 7, R);
  build(src, 'belt', 6, 7, R);
  const bp = captureBlueprint(src, rules, 2, 7, 6, 8);
  assert.deepEqual([bp.w, bp.h], [5, 2]);
  let r = bp;
  for (let i = 0; i < 4; i++) r = rotateBlueprint(rules, r);
  assert.deepEqual(r, bp);

  r = bp;
  for (let k = 0; k < 4; k++) {
    const w = autoWorld();
    const res = pasteBlueprint(w, rules, r, 4, 7);
    assert.ok(res.ok, `회전 ${k}: ${res.reason}`);
    const hopper = w.stations.find((s) => s.type === 'hopper' && s.built);
    const gate = w.stations.find((s) => s.type === 'gate');
    hopper.stock = { burger: 3 };
    run(w, secs(5));
    assert.equal(gate.mode.sent, 3, `회전 ${k}: 게이트가 벨트로 다 보냈다`);
    const onBelts = w.stations.filter((s) => s.type === 'belt').reduce((a, s) => a + s.items.length, 0);
    assert.equal(onBelts, 3, `회전 ${k}`);
    r = rotateBlueprint(rules, r);
  }
});
