// M19: 신선도. 아이스크림은 냉동이 아닌 저장소에서 녹는다 (냉동 창고·냉동동은 안전)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { buyZone } from '../public/js/sim/zones.js';
import { isCold, melting } from '../public/js/sim/fresh.js';
import { serializeWorld, loadWorld } from '../public/js/sim/save.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };
const PERISH = rules.items.ice_cream.perish;

function worldAt() {
  const w = createWorld(rules);
  Object.assign(w.stats.sold, { burger: 150, pizza: 15, fried_chicken: 15 });
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 11.5, prevX: 15.5, prevY: 11.5 });
  w.orders.timer = 1e9;
  w.chapters.ended = true;
  w.parts = { iron_plate: 900, gear: 200, heat_plate: 50, wire: 100, motor: 90, sensor: 20, circuit: 20, cooling_unit: 10 };
  w.money = 100000;
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}

test('보통 호퍼의 아이스크림은 녹고, 냉동 창고에서는 그대로. 녹지 않는 품목은 상관없다', () => {
  const w = worldAt();
  assert.ok(w.unlocked.machines.includes('cold_storage'));
  const hopper = build(w, 'hopper', 2, 8);
  const cold = build(w, 'cold_storage', 5, 8);
  hopper.stock = { ice_cream: 5, burger: 5 };
  cold.stock = { ice_cream: 5 };
  assert.deepEqual(melting(w, rules, hopper), ['ice_cream']);
  assert.ok(isCold(w, rules, cold));
  run(w, secs(PERISH * 2 + 0.5));
  assert.equal(hopper.stock.ice_cream, 3, '두 개 녹았다');
  assert.equal(hopper.stock.burger, 5);
  assert.equal(cold.stock.ice_cream, 5);
  assert.equal(w.stats.melted, 2);
});

test('냉동동에 놓은 저장소는 냉동이다', () => {
  const w = worldAt();
  for (const id of ['east1', 'south1', 'south2', 'east2', 'east3', 'south3']) assert.ok(buyZone(w, rules, id).ok, id);
  const z = rules.zones.zones.find((x) => x.id === 'south3');
  const hopper = build(w, 'hopper', z.x + 2, z.y + 2);
  hopper.stock = { cone_ice_cream: 3 };
  assert.ok(isCold(w, rules, hopper));
  run(w, secs(PERISH + 1));
  assert.equal(hopper.stock.cone_ice_cream, 3);
});

test('녹던 시간은 저장된다 (불러와도 처음부터 다시 세지 않는다)', () => {
  const w = worldAt();
  const hopper = build(w, 'hopper', 2, 8);
  hopper.stock = { ice_cream: 2 };
  run(w, secs(PERISH - 2));
  const back = loadWorld(rules, serializeWorld(w)).world;
  const h2 = stationAt(back, 2, 8);
  assert.ok(h2.melt.ice_cream > PERISH - 3);
  run(back, secs(3));
  assert.equal(h2.stock.ice_cream, 1);
});
