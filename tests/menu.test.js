// M9: 메뉴 확장 (피자 / 치킨·핫도그 / 아이스크림)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { setSupplyItem } from '../public/js/sim/station.js';
import { producible } from '../public/js/sim/market.js';
import { loadRules } from './helpers.js';

const base = loadRules();
// 시작 배치는 출고구만 (테스트가 직접 짓는다)
const rules = { ...base, game: { ...base.game, stations: base.game.stations.filter((s) => s.type === 'counter') } };
const dt = 1 / rules.game.ticksPerSecond;
const R = 0, D = 1;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };

function worldWith(sold) {
  const w = createWorld(rules);
  Object.assign(w.stats.sold, sold);
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 2.5, prevX: 15.5, prevY: 2.5 });
  w.orders.timer = 1e9;
  w.chapters.ended = true;
  w.parts = { iron_plate: 500, gear: 200, heat_plate: 50, wire: 100, motor: 50, cooling_unit: 5 };
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}

test('햄버거 80개 → 피자, 피자 15개 → 치킨·핫도그, 치킨 15개 → 디저트', () => {
  const a = worldWith({ burger: 80 });
  for (const id of ['tomato_field', 'sauce_pot', 'cheese_vat', 'pizza_oven']) assert.ok(a.unlocked.machines.includes(id), id);
  assert.ok(a.unlocked.supplies.includes('milk'));
  assert.equal(a.unlocked.machines.includes('chicken_fryer'), false);
  assert.equal(a.tutorial.track, 'pizza');

  const b = worldWith({ burger: 80, pizza: 15 });
  for (const id of ['brine_tank', 'chicken_fryer', 'sausage_maker', 'hotdog_assembler']) assert.ok(b.unlocked.machines.includes(id), id);
  assert.ok(b.unlocked.supplies.includes('raw_chicken'));

  const c = worldWith({ burger: 80, pizza: 15, fried_chicken: 15 });
  assert.ok(c.unlocked.machines.includes('freezer'));
  assert.equal(c.tutorial.track, 'dessert');
});

test('새 기계 레시피: 소스·치즈·피자·염지·치킨·소시지·핫도그·아이스크림', () => {
  const w = worldWith({ burger: 80, pizza: 15, fried_chicken: 15 });
  const cases = [
    ['sauce_pot', ['tomato', 'tomato'], 'tomato_sauce'],
    ['cheese_vat', ['milk', 'milk'], 'cheese'],
    ['pizza_oven', ['dough', 'tomato_sauce', 'cheese'], 'pizza'],
    ['brine_tank', ['raw_chicken', 'water'], 'brined_chicken'],
    ['chicken_fryer', ['brined_chicken'], 'fried_chicken'],
    ['sausage_maker', ['ground_meat', 'ground_meat'], 'sausage'],
    ['hotdog_assembler', ['bun', 'sausage'], 'hotdog'],
    ['freezer', ['milk', 'syrup'], 'ice_cream'],
  ];
  let x = 2;
  let y = 4;
  const made = cases.map(([type, inputs]) => {
    if (x + rules.machines[type].size[0] > 16) { x = 2; y += 3; } // 줄 바꿈
    const st = build(w, type, x, y);
    x += st.w + 1;
    st.contents.push(...inputs);
    return st;
  });
  run(w, secs(6));
  cases.forEach(([type, , out], i) => assert.deepEqual(made[i].output, [out], type));
});

test('부품 조립기: 모터 + 철판 2 → 냉동 유닛 (센서·열판과 헷갈리지 않는다)', () => {
  const w = worldWith({ burger: 80, pizza: 15, fried_chicken: 15 });
  const pa = build(w, 'part_assembler', 3, 3);
  pa.contents.push('motor', 'iron_plate', 'iron_plate');
  run(w, secs(6.1));
  assert.deepEqual(pa.output, ['cooling_unit']);
});

test('새 메뉴 주문은 만들 수 있게 된 뒤에만 나온다', () => {
  const early = worldWith({ burger: 60 });
  assert.equal(producible(early, rules).has('pizza'), false);
  const late = worldWith({ burger: 80, pizza: 15, fried_chicken: 15 });
  const can = producible(late, rules);
  for (const id of ['pizza', 'fried_chicken', 'hotdog', 'ice_cream']) assert.ok(can.has(id), id);
  late.orders.timer = null;
  late.orders.list = [];
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    run(late, secs(rules.orders.spawnSeconds));
    for (const o of late.orders.list) for (const id of Object.keys(o.items)) seen.add(id);
    late.orders.list = [];
  }
  assert.ok(['pizza', 'fried_chicken', 'hotdog', 'ice_cream'].some((id) => seen.has(id)), [...seen].join(','));
});

test('치킨 라인: 생닭·물 입고 → 염지통 → 튀김기 → 벨트 → 출고구, 손 안 대고 팔린다', () => {
  const w = worldWith({ burger: 80, pizza: 15 });
  const chick = build(w, 'supply', 2, 10);
  assert.ok(setSupplyItem(rules, chick, 'raw_chicken', w));
  build(w, 'inserter', 3, 10, R);
  const water = build(w, 'supply', 4, 8);
  setSupplyItem(rules, water, 'water', w);
  build(w, 'inserter', 4, 9, D);
  build(w, 'brine_tank', 4, 10);
  build(w, 'inserter', 5, 10, R);
  build(w, 'chicken_fryer', 6, 10);
  build(w, 'inserter', 7, 10, R);
  build(w, 'belt', 8, 10, D);
  build(w, 'belt', 8, 11, D); // → 출고구 (8,12)
  const money0 = w.money;
  run(w, secs(90));
  assert.ok((w.stats.sold.fried_chicken ?? 0) >= 5, `치킨 ${w.stats.sold.fried_chicken}`);
  assert.ok(w.money > money0);
});
