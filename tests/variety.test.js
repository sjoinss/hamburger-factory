// M16: 메뉴 변형 (치즈·더블·베이컨버거, 웨지감자), 기계의 만들 것 고르기, 선별기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { setMachineRecipe, machineRecipe, canAccept } from '../public/js/sim/station.js';
import { readSettings, applySettings } from '../public/js/sim/presets.js';
import { captureBlueprint, pasteBlueprint } from '../public/js/sim/blueprint.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { serializeWorld, loadWorld } from '../public/js/sim/save.js';
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
const item = (node, id, pos) => ({ item: id, pos, x: node.x + pos, y: node.y + 0.5, px: node.x + pos, py: node.y + 0.5, tag: null, bag: null });

test('햄버거 120개: 메뉴 변형 (훈연기·선별기, 돼지고기 입고)', () => {
  assert.ok(!worldAt(119).unlocked.machines.includes('sorter'));
  const w = worldAt(120);
  for (const m of ['smoker', 'sorter']) assert.ok(w.unlocked.machines.includes(m));
  for (const r of ['assemble_cheeseburger', 'assemble_double', 'smoke_bacon', 'assemble_bacon', 'bake_wedges']) assert.ok(w.unlocked.recipes.includes(r));
  assert.ok(w.unlocked.supplies.includes('pork'));
});

test('만들 것: 자동이면 재료가 먼저 다 찬 것, 정하면 그것만 (치즈를 기다린다)', () => {
  const w = worldAt(120);
  const asm = build(w, 'burger_assembler', 3, 9);
  asm.contents.push('bun', 'patty', 'lettuce_washed');
  assert.equal(machineRecipe(rules, asm).id, 'assemble_burger', '자동: 기본 햄버거');
  assert.ok(setMachineRecipe(rules, asm, 'assemble_cheeseburger'));
  assert.equal(machineRecipe(rules, asm), null, '치즈가 올 때까지 기다린다');
  assert.ok(canAccept(rules, asm, 'cheese'));
  assert.ok(!canAccept(rules, asm, 'bacon'), '정한 레시피에 없는 재료는 받지 않는다');
  asm.contents.push('cheese');
  run(w, secs(3.2));
  assert.deepEqual(asm.output, ['cheeseburger']);

  // 더블버거로 바꾸면 안 쓰는 재료는 출력 칸으로 (갇히지 않게)
  asm.output = [];
  asm.contents = ['bun', 'cheese', 'lettuce_washed'];
  setMachineRecipe(rules, asm, 'assemble_double');
  assert.deepEqual(asm.output, ['cheese']);
  asm.contents.push('patty', 'patty');
  run(w, secs(3.2));
  assert.deepEqual(asm.output, ['cheese', 'double_burger']);
  assert.ok(!setMachineRecipe(rules, asm, 'smoke_bacon'), '다른 기계의 레시피는 안 된다');
});

test('훈연기: 돼지고기 하나로 베이컨 둘 → 베이컨버거, 오븐은 웨지감자도 굽는다', () => {
  const w = worldAt(120);
  const smoker = build(w, 'smoker', 3, 9);
  smoker.contents.push('pork');
  run(w, secs(6.2));
  assert.deepEqual(smoker.output, ['bacon', 'bacon']);
  const asm = build(w, 'burger_assembler', 5, 9);
  setMachineRecipe(rules, asm, 'assemble_bacon');
  asm.contents.push('bun', 'patty', 'bacon', 'lettuce_washed');
  run(w, secs(3.2));
  assert.deepEqual(asm.output, ['bacon_burger']);
  const oven = build(w, 'oven', 8, 9);
  oven.contents.push('potato_stick', 'potato_stick');
  run(w, secs(5.2));
  assert.deepEqual(oven.output, ['wedges']);
});

test('선별기: 정한 품목만 왼쪽으로, 나머지는 앞으로. 갈 곳이 막히면 새지 않고 기다린다', () => {
  const w = worldAt(120);
  const feed = build(w, 'belt', 2, 8, R);
  const sorter = build(w, 'sorter', 3, 8, R);
  const left = build(w, 'belt', 3, 7, 3); // 오른쪽을 보는 선별기의 왼쪽 = 위
  const ahead = build(w, 'belt', 4, 8, R);
  sorter.filter = 'patty';
  feed.items = [item(feed, 'patty', 0.9), item(feed, 'bun', 0.5), item(feed, 'patty', 0.1)];
  run(w, secs(1.2));
  const got = (b) => b.items.map((it) => it.item).sort();
  assert.deepEqual(got(left), ['patty', 'patty']);
  assert.deepEqual(got(ahead), ['bun']);

  // 왼쪽이 꽉 차면 패티는 기다리고, 앞쪽으로 새지 않는다
  left.items = [item(left, 'bun', 0.2), item(left, 'bun', 0.55), item(left, 'bun', 0.9)];
  left.rot = 1; // 선별기 쪽으로 되돌려 막아 버린다
  w.stationsVersion += 1;
  ahead.items = [];
  feed.items = [item(feed, 'patty', 0.95)];
  run(w, secs(1));
  assert.equal(ahead.items.length, 0, '앞으로 새지 않았다');
  assert.equal(sorter.buffer?.item, 'patty', '선별기 안에서 기다린다');
});

test('선별기 품목·만들 것은 저장·설정 복사·청사진에 따라간다', () => {
  const w = worldAt(120);
  const sorter = build(w, 'sorter', 3, 8, R);
  const asm = build(w, 'burger_assembler', 3, 10);
  sorter.filter = 'bacon';
  setMachineRecipe(rules, asm, 'assemble_bacon');
  const back = loadWorld(rules, serializeWorld(w)).world;
  assert.equal(stationAt(back, 3, 8).filter, 'bacon');
  assert.equal(stationAt(back, 3, 10).recipe, 'assemble_bacon');

  const other = build(w, 'sorter', 6, 8, R);
  assert.ok(applySettings(w, rules, other, readSettings(rules, sorter)));
  assert.equal(other.filter, 'bacon');
  const asm2 = build(w, 'burger_assembler', 6, 10);
  assert.ok(applySettings(w, rules, asm2, readSettings(rules, asm)));
  assert.equal(asm2.recipe, 'assemble_bacon');

  const bp = { name: 'x', ...captureBlueprint(w, rules, 3, 8, 4, 10) };
  assert.ok(pasteBlueprint(w, rules, bp, 10, 4).ok);
  assert.equal(stationAt(w, 10, 4).filter, 'bacon');
  assert.equal(stationAt(w, 10, 6).recipe, 'assemble_bacon');
});
