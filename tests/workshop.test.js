// M6: 부품 공방, 전력, 구역 매입, 메뉴 확장
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine, checkPlacement } from '../public/js/sim/build.js';
import { setSupplyItem } from '../public/js/sim/station.js';
import { partCount } from '../public/js/sim/parts.js';
import { checkZone, buyZone } from '../public/js/sim/zones.js';
import { storageCapacity } from '../public/js/sim/storage.js';
import { producible } from '../public/js/sim/market.js';
import { TILE, getTile } from '../public/js/sim/grid.js';
import { loadRules } from './helpers.js';

const base = loadRules();
// 시작 배치는 출고구만 (테스트가 직접 짓는다)
const rules = { ...base, game: { ...base.game, stations: base.game.stations.filter((s) => s.type === 'counter') } };
const dt = 1 / rules.game.ticksPerSecond;
const R = 0, D = 1;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };

function worldAt(burgers) {
  const w = createWorld(rules);
  w.stats.sold.burger = burgers;
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 11.5, prevX: 15.5, prevY: 11.5 });
  w.orders.timer = 1e9;
  w.parts = { iron_plate: 500, gear: 200, heat_plate: 50, wire: 100, motor: 50 };
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}
function supply(w, x, y, item) {
  const st = build(w, 'supply', x, y);
  assert.ok(setSupplyItem(rules, st, item, w), `입고 ${item}`);
  return st;
}

test('햄버거 25개를 팔면 부품 공방 해금: 제련로·프레스·…, 철광석·석탄 입고, 전력·구역', () => {
  const w = worldAt(25);
  for (const id of ['smelter', 'press', 'wire_machine', 'gear_lathe', 'part_assembler', 'generator']) {
    assert.ok(w.unlocked.machines.includes(id), id);
  }
  assert.ok(w.unlocked.supplies.includes('iron_ore') && w.unlocked.supplies.includes('coal'));
  assert.ok(w.features.includes('power') && w.features.includes('zones'));
  assert.equal(w.tutorial.track, 'workshop');
});

test('입고구는 해금된 원료만 고를 수 있다', () => {
  const w = worldAt(25);
  const s = build(w, 'supply', 3, 3);
  assert.equal(setSupplyItem(rules, s, 'syrup', w), false, '시럽은 메뉴 확장 뒤');
  assert.equal(setSupplyItem(rules, s, 'iron_ore', w), true);
});

test('부품 라인: 철광석 → 제련로 → 프레스 → 호퍼. 호퍼의 철판으로 새 기계를 짓는다', () => {
  const w = worldAt(25);
  supply(w, 2, 3, 'iron_ore');
  build(w, 'inserter', 3, 3, R);
  build(w, 'smelter', 4, 3);
  build(w, 'inserter', 5, 3, R);
  build(w, 'press', 6, 3);
  build(w, 'inserter', 7, 3, R);
  build(w, 'belt', 8, 3, R);
  const hopper = build(w, 'hopper', 9, 3);
  run(w, secs(60));
  const plates = hopper.stock.iron_plate ?? 0;
  assert.ok(plates >= 10, `호퍼에 철판 ${plates}개`);

  // 받은 부품이 하나도 없어도 호퍼의 철판으로 짓는다
  w.parts = {};
  assert.equal(partCount(w, rules, 'iron_plate'), plates);
  build(w, 'belt', 10, 6, R);
  assert.equal(hopper.stock.iron_plate, plates - rules.machines.belt.cost.iron_plate);
  assert.equal(checkPlacement(w, rules, 'smelter', 12, 8, 0).reason, 'parts', '열판은 없음');
});

test('부품 조립기: 철판 + 철선 → 열판, 기어 + 철선 → 모터', () => {
  const w = worldAt(25);
  const pa = build(w, 'part_assembler', 5, 5);
  pa.contents = ['gear', 'gear', 'wire', 'wire'];
  run(w, secs(6));
  assert.deepEqual(pa.output, ['motor']);
  pa.output = [];
  pa.contents = ['iron_plate', 'wire', 'wire'];
  run(w, secs(5));
  assert.deepEqual(pa.output, ['heat_plate']);
});

test('전력: 쓰는 만큼 모자라면 모든 기계가 같은 비율로 느려지고, 발전기에 석탄을 넣으면 회복', () => {
  const w = worldAt(25);
  const smelters = [];
  for (let i = 0; i < 8; i++) smelters.push(build(w, 'smelter', 2 + i, 5));
  for (const s of smelters) s.contents = ['iron_ore', 'iron_ore', 'iron_ore', 'iron_ore'];
  run(w, 3);
  const need = 8 * rules.machines.smelter.power;
  assert.equal(w.power.demand, need);
  assert.equal(w.power.supply, rules.zones.basePower);
  assert.ok(Math.abs(w.power.ratio - rules.zones.basePower / need) < 1e-9);
  const before = smelters[0].progress;
  run(w, secs(1));
  const slow = smelters[0].progress - before;
  assert.ok(Math.abs(slow - w.power.ratio) < 0.06, `1초에 ${slow} 진행 (비율 ${w.power.ratio})`);

  const gen = build(w, 'generator', 2, 8);
  gen.contents = ['coal', 'coal'];
  run(w, 2);
  assert.equal(w.power.supply, rules.zones.basePower + rules.machines.generator.output);
  assert.equal(w.power.ratio, 1);
  run(w, secs(rules.machines.generator.fuels.coal * 2 + 1));
  assert.equal(gen.contents.length, 0, '석탄을 다 태움');
  assert.equal(w.power.supply, rules.zones.basePower);
});

test('벨트로 발전기에 석탄을 바로 넣을 수 있다', () => {
  const w = worldAt(25);
  const gen = build(w, 'generator', 5, 5);
  const belt = build(w, 'belt', 4, 5, R);
  belt.items.push({ item: 'coal', pos: 1, x: 5, y: 5.5, px: 5, py: 5.5 });
  run(w, 2);
  assert.ok(gen.contents.includes('coal') || gen.fuelLeft > 0);
});

test('구역: 돈 + 부품으로 산다. 바닥이 열리고 사이 벽이 트이며, 창고동 호퍼는 용량 +50%', () => {
  const pre = worldAt(15);
  assert.equal(checkZone(pre, rules, 'east1').reason, 'locked', '부품 공방 전에는 못 산다');

  const w = worldAt(25);
  const z1 = rules.zones.zones[0];
  assert.equal(checkZone(w, rules, 'east2').reason, 'requires');
  w.money = z1.cost.money - 1;
  assert.equal(checkZone(w, rules, 'east1').reason, 'money');
  w.money = z1.cost.money + 50;
  const plates = partCount(w, rules, 'iron_plate');
  assert.ok(buyZone(w, rules, 'east1').ok);
  assert.equal(w.money, 50);
  assert.equal(partCount(w, rules, 'iron_plate'), plates - z1.cost.parts.iron_plate);
  assert.equal(getTile(w.grid, z1.x + 3, 5), TILE.FLOOR);
  assert.equal(getTile(w.grid, z1.x - 1, 5), TILE.FLOOR, '사이 벽이 트임');
  assert.equal(getTile(w.grid, z1.x + z1.w, 5), TILE.WALL, '다음 구역과의 벽은 그대로');

  const hopper = build(w, 'hopper', z1.x + 2, 4);
  assert.equal(storageCapacity(rules, hopper), Math.floor(rules.machines.hopper.capacity * z1.trait.mult));
  const home = build(w, 'hopper', 3, 4);
  assert.equal(storageCapacity(rules, home), rules.machines.hopper.capacity);
});

test('햄버거 40개: 메뉴 확장. 감자밭 → 절단기 → 튀김기, 시럽 + 물 → 콜라, 포장기 → 세트', () => {
  const w = worldAt(40);
  assert.ok(w.unlocked.machines.includes('packer'));
  assert.ok(w.unlocked.supplies.includes('syrup'));
  build(w, 'potato_field', 2, 3); // (2,3)-(3,4)
  build(w, 'inserter', 4, 3, R);
  build(w, 'potato_cutter', 5, 3);
  build(w, 'inserter', 6, 3, R);
  const fryer = build(w, 'fryer', 7, 3);
  run(w, secs(40));
  assert.ok(fryer.output.includes('fries'), JSON.stringify(fryer.output));

  const mixer = build(w, 'soda_mixer', 5, 8);
  mixer.contents = ['syrup', 'water'];
  run(w, secs(4));
  assert.deepEqual(mixer.output, ['cola']);

  const packer = build(w, 'packer', 9, 8);
  packer.contents = ['burger', 'fries', 'cola'];
  run(w, secs(4));
  assert.deepEqual(packer.output, ['set']);
});

test('주문과 시세는 만들 수 있는 품목만', () => {
  const early = worldAt(15);
  assert.ok(!producible(early, rules).has('set'));
  early.orders.timer = null;
  run(early, secs(rules.orders.spawnSeconds * 12));
  for (const o of early.orders.list) {
    for (const id of Object.keys(o.items)) assert.ok(['burger', 'patty'].includes(id), `일찍 나온 주문: ${id}`);
  }
  assert.ok(!('set' in early.market.target));

  const late = worldAt(40);
  assert.ok(producible(late, rules).has('set') && producible(late, rules).has('cola'));
});

test('부품 공방·전력·구역 상태도 JSON 직렬화 가능', () => {
  const w = worldAt(40);
  w.money = 5000;
  buyZone(w, rules, 'east1');
  const gen = build(w, 'generator', 2, 8);
  gen.contents = ['coal'];
  run(w, secs(5));
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
});
