// 밸런스 원칙: 늦게 열리는 메뉴일수록 기계 1초당 순이익이 높다 (공정이 깊어지는 만큼 보상).
// 기계 시간 = 원료부터 완성까지 거치는 기계 작업 시간의 합 (밭은 자라는 시간 / 수확량, 입고구는 들여오는 시간)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../public/js/sim/world.js';
import { serializeWorld, loadWorld } from '../public/js/sim/save.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const first = {};
for (const r of rules.recipes) for (const o of Object.keys(r.outputs)) first[o] ??= r;
const farmOf = Object.fromEntries(Object.values(rules.machines).filter((m) => m.kind === 'farm').map((m) => [m.crop, m]));

/** { sec: 기계 시간, buy: 원료 값 } */
function cost(id) {
  if (farmOf[id]) return { sec: farmOf[id].growSeconds / farmOf[id].yield, buy: 0 };
  if (!first[id]) return { sec: rules.machines.supply.seconds, buy: rules.items[id].buy ?? 0 };
  const r = first[id];
  const st = r.stations.find((s) => rules.machines[s].kind === 'machine') ?? r.stations[0];
  const out = r.outputs[id];
  let sec = r.seconds / rules.machines[st].speed / out;
  let buy = 0;
  for (const [k, n] of Object.entries(r.inputs)) {
    const c = cost(k);
    sec += (c.sec * n) / out;
    buy += (c.buy * n) / out;
  }
  return { sec, buy };
}
const perSec = (id) => {
  const c = cost(id);
  return (rules.items[id].price - c.buy) / c.sec;
};

// 해금 순서대로 묶은 메뉴
const TIERS = [
  ['burger'],
  ['fries', 'cola', 'set'],
  ['pizza'],
  ['hotdog', 'fried_chicken'],
  ['ice_cream'],
  ['cheeseburger', 'double_burger', 'bacon_burger', 'wedges'],
  ['cone_ice_cream'],
];

test('늦게 열리는 메뉴일수록 가장 잘 버는 메뉴가 더 번다', () => {
  let prev = 0;
  for (const tier of TIERS) {
    const best = Math.max(...tier.map(perSec));
    assert.ok(best >= prev * 0.97, `${tier.join(',')}: ${best.toFixed(3)} < 앞 단계 ${prev.toFixed(3)}`);
    prev = Math.max(prev, best);
  }
});

test('어떤 메뉴도 햄버거보다 크게 못하지 않고, 한 메뉴가 압도하지 않는다', () => {
  const base = perSec('burger');
  for (const id of TIERS.flat()) {
    const v = perSec(id);
    assert.ok(v >= base * 0.9, `${id} ${v.toFixed(3)} 가 햄버거 ${base.toFixed(3)} 보다 너무 낮다`);
    assert.ok(v <= base * 2, `${id} ${v.toFixed(3)} 가 너무 높다 (정답 하나로 쏠림)`);
  }
  assert.ok(cost('ice_cream').sec > rules.recipes.find((r) => r.id === 'freeze_ice_cream').seconds * 2, '아이스크림은 한 단계짜리가 아니다');
});

test('세트는 따로 파는 것보다 비싸다', () => {
  const sum = ['burger', 'fries', 'cola'].reduce((a, id) => a + rules.items[id].price, 0);
  assert.ok(rules.items.set.price > sum);
});

test('이미 지난 단계에 나중에 더해진 기계·레시피는 불러올 때 열린다 (업데이트 전 저장)', () => {
  const w = createWorld(rules);
  w.stagesDone = ['first_machine', 'conveyor', 'automation', 'storage', 'workshop', 'menu', 'full_auto', 'pizza', 'chicken'];
  w.unlocked.machines = w.unlocked.machines.filter((m) => m !== 'deboner');
  w.unlocked.recipes = w.unlocked.recipes.filter((r) => r !== 'debone' && r !== 'mix_batter');
  const back = loadWorld(rules, serializeWorld(w)).world;
  assert.ok(back.unlocked.machines.includes('deboner'));
  assert.ok(back.unlocked.recipes.includes('debone') && back.unlocked.recipes.includes('mix_batter'));
});
