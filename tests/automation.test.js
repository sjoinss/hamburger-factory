// M4: 입고 → 햄버거 완성 → 판매까지 사람 손 없이, 병목 수치, 가동률, 통계
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { setSupplyItem } from '../public/js/sim/station.js';
import { insertSorted, makeBeltItem } from '../public/js/sim/conveyor.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { utilization, perMinute } from '../public/js/sim/stats.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const R = 0, D = 1, L = 2;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };

function automationWorld() {
  const w = createWorld(rules);
  w.stats.sold.burger = 6;
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 1.5, prevX: 15.5, prevY: 1.5 });
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res.station;
}
function supply(w, x, y, item) {
  const st = build(w, 'supply', x, y);
  assert.ok(setSupplyItem(rules, st, item));
  return st;
}

/** 전체 버거 라인. 한 칸짜리 투입기로 기계끼리 바로 잇고, 완성품은 벨트로 출고구까지. */
function buildBurgerLine(w) {
  // 고기: 입고 → 절단기 → 그릴 → 조립기(왼쪽)
  supply(w, 3, 8, 'raw_meat');
  build(w, 'inserter', 4, 8, R);
  build(w, 'meat_cutter', 5, 8);
  build(w, 'inserter', 6, 8, R);
  build(w, 'grill', 7, 8);
  build(w, 'inserter', 8, 8, R);
  const assembler = build(w, 'burger_assembler', 9, 8); // (9,8)-(10,8)
  // 번: 밀가루 입고 → 반죽기 → 오븐 → 조립기(위)
  supply(w, 9, 2, 'flour');
  build(w, 'inserter', 9, 3, D);
  build(w, 'mixer', 9, 4);
  build(w, 'inserter', 9, 5, D);
  build(w, 'oven', 9, 6);
  build(w, 'inserter', 9, 7, D);
  // 양상추: 입고 → 세척기 → 조립기(위)
  supply(w, 10, 4, 'lettuce');
  build(w, 'inserter', 10, 5, D);
  build(w, 'washer', 10, 6);
  build(w, 'inserter', 10, 7, D);
  // 완성품: 조립기 → 벨트 → 출고구
  build(w, 'inserter', 11, 8, R);
  build(w, 'belt', 12, 8, D);
  build(w, 'belt', 12, 9, D);
  for (let x = 12; x >= 8; x--) build(w, 'belt', x, 10, L);
  build(w, 'inserter', 8, 11, D);
  return assembler;
}

test('햄버거 6개를 팔면 자동화 기계 해금 + 새 레시피 + 부품', () => {
  const w = automationWorld();
  for (const id of ['supply', 'meat_cutter', 'washer', 'mixer', 'oven', 'burger_assembler']) {
    assert.ok(w.unlocked.machines.includes(id), id);
  }
  assert.ok(w.unlocked.recipes.includes('mix_dough') && w.unlocked.recipes.includes('bake_bun'));
  assert.equal(w.tutorial.track, 'automation');
});

test('입고구는 정해진 재료를 일정 시간마다 들여오고, 꽉 차면 멈춘다', () => {
  const w = automationWorld();
  const s = supply(w, 5, 9, 'flour');
  assert.equal(setSupplyItem(rules, s, 'burger'), false, '목록에 없는 품목은 안 됨');
  run(w, secs(rules.machines.supply.seconds * 2 + 0.1));
  assert.deepEqual(s.output, ['flour', 'flour']);
  run(w, secs(60));
  assert.equal(s.output.length, rules.machines.supply.outputCap);
  assert.equal(s.status, 'blocked');
});

test('입고 → 햄버거 → 판매까지 사람 손 없이 흐른다', () => {
  const w = automationWorld();
  buildBurgerLine(w);
  const money0 = w.money;
  run(w, secs(120));
  const burgers = w.stats.sold.burger - 6;
  assert.ok(burgers >= 10, `2분 동안 판 햄버거 ${burgers}개`);
  // 15개를 넘기면 시장/주문이 열려 시세가 ±20% 움직인다
  assert.ok(w.money - money0 >= burgers * rules.items.burger.price * 0.8, `수입 ${w.money - money0}`);
  assert.equal(w.tutorial.log['made:burger_assembler'], true, '튜토리얼: 기계가 햄버거를 만듦');

  // 통계: 분당 생산/판매가 잡힌다
  const rates = perMinute(w);
  assert.ok(rates.burger.produced > 0 && rates.burger.sold > 0, JSON.stringify(rates.burger));
  assert.ok(rates.flour.consumed >= rates.dough.produced * 2 - 2, '밀가루 2개 → 반죽 1개');
});

test('병목: 오븐이 가장 느려서 조립기는 번을 기다린다 (가동률로 보인다)', () => {
  const w = automationWorld();
  const assembler = buildBurgerLine(w);
  run(w, secs(90));
  const oven = stationAt(w, 9, 6);
  const uOven = utilization(oven, 60);
  const uAsm = utilization(assembler, 60);
  assert.ok(uOven.running > 0.8, `오븐 가동 ${uOven.running}`);
  assert.ok(uAsm.idle >= 0.3, `조립기 입력 대기 ${uAsm.idle} (가동 ${uAsm.running})`);
});

test('막힌 벨트는 막힘 수치가 오르고, 빈 벨트는 한산 수치가 오른다', () => {
  const w = automationWorld();
  const full = [build(w, 'belt', 3, 10, R), build(w, 'belt', 4, 10, R)];
  const empty = build(w, 'belt', 3, 11, R);
  for (let i = 0; i < secs(15); i++) {
    if (full[0].items.every((it) => it.pos >= 0.34)) insertSorted(full[0].items, makeBeltItem(full[0], 'patty', 0));
    run(w, 1);
  }
  assert.ok(full[1].jam > 0.5, `jam ${full[1].jam}`);
  assert.ok(empty.idle > 0.8, `idle ${empty.idle}`);
  assert.ok(full[1].idle < 0.2);
});

test('가동 기록은 최근 60초만 남는다', () => {
  const w = automationWorld();
  const s = supply(w, 5, 9, 'flour');
  run(w, secs(100));
  assert.equal(s.hist.length, 60);
  const u = utilization(s);
  assert.ok(Math.abs(u.running + u.idle + u.blocked - 1) < 1e-9);
});

test('자동화 라인이 돌아가는 상태도 JSON 직렬화 가능', () => {
  const w = automationWorld();
  buildBurgerLine(w);
  run(w, secs(20));
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
});
