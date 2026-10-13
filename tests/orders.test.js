// M5: 깔때기 호퍼/사일로, 출고 게이트, 주문서, 시장 시세
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { insertSorted, makeBeltItem } from '../public/js/sim/conveyor.js';
import { setStorageFilter, storageTotal } from '../public/js/sim/storage.js';
import { setGateManual, setGateOrder } from '../public/js/sim/gate.js';
import { receiveAtCounter, openOrders } from '../public/js/sim/orders.js';
import { marketPrice } from '../public/js/sim/market.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { TILE, getTile } from '../public/js/sim/grid.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const R = 0, D = 1;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };
const BURGER = rules.items.burger.price;

function storageWorld({ orders = true } = {}) {
  const w = createWorld(rules);
  w.stats.sold.burger = 15;
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 1.5, prevX: 15.5, prevY: 1.5 });
  if (!orders) w.features = w.features.filter((f) => f !== 'orders');
  w.orders.timer = 1e9; // 테스트에서는 손님이 저절로 오지 않게 (필요한 테스트만 직접 넣는다)
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
const counter = (w) => stationAt(w, 7, 12);
/** 호퍼(7,9) 2x2 + 그 아래 게이트(7,11) 가 출고구(7,12)로 바로 내보내는 배치 */
function gateToCounter(w) {
  const hopper = build(w, 'hopper', 7, 9);
  const gate = build(w, 'gate', 7, 11, D);
  return { hopper, gate };
}

test('햄버거 15개를 팔면 호퍼/사일로/게이트 + 주문서·시세 해금', () => {
  const w = storageWorld();
  for (const id of ['hopper', 'silo', 'gate']) assert.ok(w.unlocked.machines.includes(id));
  assert.deepEqual(w.features.sort(), ['market', 'orders']);
  assert.equal(w.tutorial.track, 'storage');
});

test('가게 앞에는 길이 있고, 출고구 뒤 벽은 창구', () => {
  const w = storageWorld();
  const bottomWall = rules.game.map.roomHeight + 1;
  assert.equal(getTile(w.grid, 7, bottomWall), TILE.WINDOW);
  assert.equal(getTile(w.grid, 3, bottomWall), TILE.WALL);
  assert.equal(getTile(w.grid, 7, bottomWall + 1), TILE.STREET);
  assert.equal(placeMachine(w, rules, 'belt', 7, bottomWall + 1, R).reason, 'blocked', '길에는 못 짓는다');
});

test('벨트 끝이 호퍼를 가리키면 투입기 없이 쌓인다. 꽉 차면 벨트가 밀린다', () => {
  const w = storageWorld();
  const hopper = build(w, 'hopper', 10, 8);
  const belt = build(w, 'belt', 9, 8, R);
  const cap = rules.machines.hopper.capacity;
  for (let i = 0; i < secs(cap / 2 + 20); i++) {
    if (belt.items.every((it) => it.pos >= 0.34)) insertSorted(belt.items, makeBeltItem(belt, 'burger', 0));
    run(w, 1);
  }
  assert.equal(storageTotal(hopper), cap);
  assert.ok(belt.items.length >= 2 && belt.items[0].pos === 1, '꽉 차서 벨트 끝에 대기');
  assert.equal(w.tutorial.log['fed:hopper'], true);
});

test('호퍼 필터와 사일로 한 품목 제한', () => {
  const w = storageWorld();
  const hopper = build(w, 'hopper', 10, 8);
  setStorageFilter(rules, hopper, 'burger');
  const belt = build(w, 'belt', 9, 8, R);
  insertSorted(belt.items, makeBeltItem(belt, 'patty', 1));
  run(w, 5);
  assert.equal(storageTotal(hopper), 0, '패티는 거부');
  assert.equal(belt.items.length, 1);

  const silo = build(w, 'silo', 3, 7);
  const b2 = build(w, 'belt', 3, 10, 3); // 위로 (사일로 아래쪽 칸)
  insertSorted(b2.items, makeBeltItem(b2, 'patty', 1));
  run(w, 2);
  insertSorted(b2.items, makeBeltItem(b2, 'burger', 1));
  run(w, 5);
  assert.deepEqual(silo.stock, { patty: 1 }, '처음 받은 품목만');
});

test('출고구: 주문 먼저 채우고, 남는 건 시세로 판다', () => {
  const w = storageWorld();
  const a = addOrder(w, { burger: 2 }, 'normal', 50);
  const b = addOrder(w, { burger: 1 }, 'special', 40);
  const money0 = w.money;
  receiveAtCounter(w, rules, 'burger', counter(w));
  assert.equal(a.delivered.burger, 1, '오래된 주문부터');
  receiveAtCounter(w, rules, 'burger', counter(w), b.id); // 번호표 붙은 물건은 그 주문으로
  assert.equal(b.state, 'done');
  assert.equal(w.money - money0, 40);
  receiveAtCounter(w, rules, 'burger', counter(w));
  assert.equal(a.state, 'done');
  const before = w.money;
  receiveAtCounter(w, rules, 'burger', counter(w)); // 주문 없음 → 시세
  assert.equal(w.money - before, marketPrice(w, rules, 'burger'));
  assert.equal(w.reputation, rules.orders.kinds.normal.repDone + rules.orders.kinds.special.repDone);
});

test('특별 주문 시간이 지나면 실패: 평판 하락, 손님은 잠시 뒤 떠난다', () => {
  const w = storageWorld();
  const o = addOrder(w, { burger: 3 }, 'special', 99, w.time + 2);
  run(w, secs(2.1));
  assert.equal(o.state, 'failed');
  assert.equal(w.reputation, rules.orders.kinds.special.repFail);
  assert.equal(w.orders.list.length, 1, '반응하는 동안은 남아 있다');
  run(w, secs(rules.orders.leaveSeconds + 0.1));
  assert.equal(w.orders.list.length, 0);
});

test('손님은 시간마다 오고 최대 6건까지만', () => {
  const w = storageWorld();
  w.orders.timer = null;
  run(w, secs(rules.orders.firstSpawnSeconds + 0.1));
  assert.equal(openOrders(w).length, 1);
  run(w, secs(rules.orders.spawnSeconds * 10));
  const open = openOrders(w).filter((o) => o.deadline === null || o.deadline > w.time);
  assert.ok(open.length <= rules.orders.maxOpen);
  for (const o of w.orders.list) {
    assert.ok(o.reward > 0);
    for (const item of Object.keys(o.items)) assert.ok(rules.items[item].price > 0);
  }
});

test('게이트 수동: 호퍼에서 정한 수만큼 출고구로', () => {
  const w = storageWorld({ orders: false });
  const { hopper, gate } = gateToCounter(w);
  hopper.stock = { burger: 10 };
  setGateManual(gate, 'burger', 3, false);
  const money0 = w.money;
  run(w, secs(5));
  assert.equal(hopper.stock.burger, 7);
  assert.equal(w.stats.sold.burger, 15 + 3);
  assert.ok(w.money > money0);
  assert.equal(gate.reason, 'done');

  setGateManual(gate, 'burger', 2, true); // 반복: 재고가 떨어질 때까지 계속
  run(w, secs(10));
  assert.equal(hopper.stock.burger ?? 0, 0);
  assert.equal(gate.reason, 'no-stock');
});

test('게이트 주문 모드: 맡은 주문을 정확히 채우고 보상이 들어온다', () => {
  const w = storageWorld();
  const { hopper, gate } = gateToCounter(w);
  hopper.stock = { burger: 5, patty: 5 };
  const decoy = addOrder(w, { burger: 3 }, 'normal', 10); // 먼저 온 다른 주문
  const target = addOrder(w, { burger: 2, patty: 1 }, 'special', 77, w.time + 60);
  setGateOrder(gate, target.id);
  const money0 = w.money;
  run(w, secs(5));
  assert.equal(target.state, 'done', '번호표 덕분에 먼저 온 주문에 뺏기지 않는다');
  assert.equal(decoy.delivered.burger ?? 0, 0);
  assert.equal(w.money - money0, 77);
  assert.deepEqual(hopper.stock, { burger: 3, patty: 4 });
  assert.equal(w.tutorial.log['order:any'], true);
});

test('게이트 → 벨트 → 출고구도 번호표가 따라간다', () => {
  const w = storageWorld();
  const hopper = build(w, 'hopper', 10, 8);
  const gate = build(w, 'gate', 12, 8, R); // (12,8)-(12,9), 앞 = (13,8)
  build(w, 'belt', 13, 8, D);
  for (let y = 9; y <= 11; y++) build(w, 'belt', 13, y, D);
  // 출고구로 꺾기: (13,11) 아래는 벽이니 왼쪽으로
  stationAt(w, 13, 11).rot = 2;
  w.stationsVersion += 1;
  for (let x = 12; x >= 9; x--) build(w, 'belt', x, 11, 2);
  build(w, 'belt', 8, 11, D); // 출고구 (8,12) 를 가리킨다
  hopper.stock = { burger: 4 };
  const decoy = addOrder(w, { burger: 2 }, 'normal', 10);
  const target = addOrder(w, { burger: 2 }, 'bulk', 55, w.time + 120);
  setGateOrder(gate, target.id);
  run(w, secs(20));
  assert.equal(target.state, 'done');
  assert.equal(decoy.state, 'open');
});

test('시세: 시장이 열리기 전엔 기본값, 열리면 ±20% 안에서 움직인다', () => {
  const before = createWorld(rules);
  assert.equal(marketPrice(before, rules, 'burger'), BURGER);
  const w = storageWorld();
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    run(w, secs(10));
    const p = marketPrice(w, rules, 'burger');
    seen.add(p);
    assert.ok(p >= Math.floor(BURGER * 0.8) && p <= Math.ceil(BURGER * 1.2), `시세 ${p}`);
  }
  assert.ok(seen.size > 1, '시세가 움직인다');
  assert.ok(w.market.headline);
});

test('주문·시장이 있는 상태도 JSON 직렬화 가능, 같은 씨앗이면 같은 결과', () => {
  const a = storageWorld();
  const b = storageWorld();
  a.orders.timer = null;
  b.orders.timer = null;
  run(a, secs(120));
  run(b, secs(120));
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.deepEqual(a.orders, b.orders);
  assert.deepEqual(a.market, b.market);
});
