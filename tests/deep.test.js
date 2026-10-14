// M18: 후반 메뉴 공정 (치킨: 발골·튀김옷 / 아이스크림: 원심분리·설탕·콘) + 대형 오븐
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { setMachineRecipe } from '../public/js/sim/station.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };

function worldWith(sold) {
  const w = createWorld(rules);
  Object.assign(w.stats.sold, sold);
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 11.5, prevX: 15.5, prevY: 11.5 });
  w.orders.timer = 1e9;
  w.chapters.ended = true;
  w.parts = { iron_plate: 500, gear: 200, heat_plate: 50, wire: 100, motor: 50, sensor: 20, circuit: 20, cooling_unit: 5 };
  w.money = 10000;
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}
const ALL = { burger: 150, pizza: 15, fried_chicken: 15 };

test('단계마다 새 공정 기계가 열린다', () => {
  const w = worldWith(ALL);
  for (const m of ['deboner', 'centrifuge', 'sugarcane_field', 'sugar_refiner', 'cone_mold', 'big_oven']) {
    assert.ok(w.unlocked.machines.includes(m), m);
  }
});

test('반죽기: 밀가루 2 → 반죽, 밀가루 + 물 → 튀김옷 (만들 것으로 고정 가능)', () => {
  const w = worldWith(ALL);
  const mixer = build(w, 'mixer', 3, 9);
  mixer.contents.push('flour', 'water');
  run(w, secs(2.2));
  assert.deepEqual(mixer.output, ['batter']);
  setMachineRecipe(rules, mixer, 'mix_batter');
  mixer.output = [];
  mixer.contents.push('flour', 'flour');
  run(w, secs(3.2));
  assert.deepEqual(mixer.output, [], '튀김옷으로 정하면 반죽을 만들지 않는다');
});

test('콘 아이스크림: 크림 + 설탕 + 콘. 냉동고는 만들 것을 정해 둔다', () => {
  const w = worldWith(ALL);
  const mold = build(w, 'cone_mold', 3, 9);
  mold.contents.push('dough');
  run(w, secs(4.2));
  assert.deepEqual(mold.output, ['cone', 'cone']);
  const freezer = build(w, 'freezer', 5, 9);
  setMachineRecipe(rules, freezer, 'freeze_cone');
  freezer.contents.push('cream', 'sugar');
  run(w, secs(6.2));
  assert.deepEqual(freezer.output, [], '콘이 올 때까지 기다린다');
  freezer.contents.push('cone');
  run(w, secs(6.2));
  assert.deepEqual(freezer.output, ['cone_ice_cream']);
});

test('부산물 단계 뒤: 발골기는 닭뼈, 원심분리기는 탈지우유 → 치즈 통·퇴비통으로', () => {
  const w = worldWith(ALL);
  const deboner = build(w, 'deboner', 3, 9);
  deboner.contents.push('raw_chicken');
  run(w, secs(3.2));
  assert.deepEqual(deboner.output.sort(), ['bone', 'chicken_meat']);
  const cf = build(w, 'centrifuge', 5, 9);
  cf.contents.push('milk', 'milk');
  run(w, secs(4.2));
  assert.deepEqual(cf.output.sort(), ['cream', 'skim_milk']);
  const vat = build(w, 'cheese_vat', 7, 9);
  setMachineRecipe(rules, vat, 'make_cheese_skim');
  vat.contents.push('skim_milk', 'skim_milk', 'skim_milk');
  run(w, secs(5.2));
  assert.deepEqual(vat.output, ['cheese']);
  const bin = build(w, 'compost_bin', 9, 9);
  setMachineRecipe(rules, bin, 'compost_bone');
  bin.contents.push('bone', 'bone');
  run(w, secs(6.2));
  assert.deepEqual(bin.output, ['fertilizer']);
});

test('대형 오븐: 반죽 8개를 한 번에 → 번 8개 (한 개씩보다 빠르지만 다 모여야 시작)', () => {
  const w = worldWith(ALL);
  const big = build(w, 'big_oven', 3, 8);
  for (let i = 0; i < 7; i++) big.contents.push('dough');
  run(w, secs(17));
  assert.deepEqual(big.output, [], '7개로는 시작하지 않는다');
  big.contents.push('dough');
  run(w, secs(16.2));
  assert.equal(big.output.filter((x) => x === 'bun').length, 8);
  const batch = rules.recipes.find((r) => r.id === 'bake_bun_batch');
  const single = rules.recipes.find((r) => r.id === 'bake_bun');
  assert.ok(batch.seconds / 8 < single.seconds, '한 개당 시간은 더 짧다');
});
