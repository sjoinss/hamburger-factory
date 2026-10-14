// M17: 부산물과 순환 (폐식용유 → 바이오 연료 → 발전기, 감자 껍질 → 비료 → 밭)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { findInteraction } from '../public/js/sim/interact.js';
import { serializeWorld, loadWorld } from '../public/js/sim/save.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };
const R = 0;

function worldAt(burgers) {
  const w = createWorld(rules);
  w.stats.sold.burger = burgers;
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 11.5, prevX: 15.5, prevY: 11.5 });
  w.orders.timer = 1e9;
  w.chapters.ended = true;
  w.parts = { iron_plate: 500, gear: 200, heat_plate: 50, wire: 100, motor: 50, sensor: 20, circuit: 20 };
  w.money = 10000;
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}
const every = (id) => rules.recipes.find((r) => r.id === id).byproduct.every;

test('햄버거 150개: 재활용 단계. 그 전에는 부산물이 나오지 않는다', () => {
  const before = worldAt(149);
  const fryer = build(before, 'fryer', 3, 9);
  for (let i = 0; i < every('fry_fries'); i++) {
    fryer.contents.push('potato_stick', 'potato_stick');
    run(before, secs(4.1));
    fryer.output = fryer.output.filter((x) => x !== 'fries');
  }
  assert.deepEqual(fryer.output, [], '부산물 없음');

  const w = worldAt(150);
  assert.ok(w.features.includes('byproducts'));
  for (const m of ['refiner', 'compost_bin']) assert.ok(w.unlocked.machines.includes(m));
});

test('튀김기: 몇 번에 한 번 폐식용유. 빼 주지 않으면 출력 칸이 차서 멈춘다', () => {
  const w = worldAt(150);
  const fryer = build(w, 'fryer', 3, 9);
  const n = every('fry_fries');
  let fries = 0;
  for (let i = 0; i < n; i++) {
    fryer.contents.push('potato_stick', 'potato_stick');
    run(w, secs(4.1));
    // 완성품은 투입기가 빼 간다고 치고, 폐식용유만 남긴다
    fries += fryer.output.filter((x) => x === 'fries').length;
    fryer.output = fryer.output.filter((x) => x !== 'fries');
  }
  assert.equal(fries, n);
  assert.deepEqual(fryer.output, ['used_oil'], '폐식용유 하나');
  // 계속 두면 막힌다
  for (let i = 0; i < 10; i++) fryer.contents.push('potato_stick');
  run(w, secs(20));
  assert.equal(fryer.status, 'blocked');
  assert.ok(fryer.output.length <= rules.machines.fryer.outputCap);
});

test('투입기는 앞에 놓을 수 있는 것을 고른다 (폐식용유가 앞에 있어도 감자튀김을 꺼낸다)', () => {
  const w = worldAt(150);
  const fryer = build(w, 'fryer', 3, 9);
  build(w, 'inserter', 4, 9, R);
  const refiner = build(w, 'refiner', 5, 9);
  fryer.output = ['fries', 'used_oil', 'fries'];
  run(w, secs(2));
  assert.deepEqual(refiner.contents, ['used_oil'], '정제기에는 폐식용유만');
  assert.deepEqual(fryer.output, ['fries', 'fries']);
});

test('폐유 정제기 → 바이오 연료 → 발전기 (석탄보다 오래 탄다)', () => {
  const w = worldAt(150);
  const refiner = build(w, 'refiner', 3, 9);
  refiner.contents.push('used_oil', 'used_oil');
  run(w, secs(4.2));
  assert.deepEqual(refiner.output, ['bio_fuel']);
  const fuels = rules.machines.generator.fuels;
  assert.ok(fuels.bio_fuel > fuels.coal);
  const gen = build(w, 'generator', 6, 8);
  gen.contents = ['bio_fuel'];
  run(w, 2);
  assert.equal(gen.status, 'running');
  run(w, secs(fuels.coal + 1));
  assert.equal(gen.status, 'running', '석탄이면 꺼졌을 시간에도 돈다');
});

test('감자 껍질 → 퇴비통 → 비료 → 밭이 빨리 자란다 (손으로도 준다)', () => {
  const w = worldAt(150);
  const cutter = build(w, 'potato_cutter', 3, 9);
  for (let i = 0; i < every('cut_potato'); i++) {
    cutter.contents.push('potato');
    run(w, secs(2.1));
    cutter.output = cutter.output.filter((x) => x !== 'potato_stick');
  }
  assert.ok(cutter.output.includes('peel'));
  const bin = build(w, 'compost_bin', 5, 9);
  bin.contents.push('peel', 'peel', 'peel', 'peel');
  run(w, secs(6.2));
  assert.deepEqual(bin.output, ['fertilizer']);

  // 비료 준 밭은 두 배로 빨리, 한 번 다 자랄 때 하나를 쓴다
  const grow = rules.machines.wheat_field.growSeconds;
  const fed = build(w, 'wheat_field', 8, 8);
  const plain = build(w, 'wheat_field', 11, 8);
  w.player.inventory[0] = 'fertilizer';
  Object.assign(w.player, { x: 8.5, y: 10.5, dir: 'up' });
  const act = findInteraction(w, rules);
  assert.equal(act.action, 'deposit', '손으로 비료 주기');
  stepWorld(w, { ...NO_INPUT, interactPressed: true, interactHeld: true }, dt, rules);
  assert.deepEqual(fed.contents, ['fertilizer']);
  run(w, secs(grow / rules.game.fertilizer.speed + 0.2));
  assert.ok(fed.output.length > 0, '비료 준 밭은 다 자랐다');
  assert.equal(plain.output.length, 0);
  assert.deepEqual(fed.contents, [], '비료 하나를 썼다');
});

test('부산물 차례·밭 비료는 저장된다', () => {
  const w = worldAt(150);
  const fryer = build(w, 'fryer', 3, 9);
  fryer.byCount = 2;
  const field = build(w, 'wheat_field', 8, 8);
  field.contents = ['fertilizer'];
  const back = loadWorld(rules, serializeWorld(w)).world;
  assert.equal(stationAt(back, 3, 9).byCount, 2);
  assert.deepEqual(stationAt(back, 8, 8).contents, ['fertilizer']);
});
