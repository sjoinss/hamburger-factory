// M4: 입고 → 햄버거 완성 → 판매까지 사람 손 없이, 병목 수치, 가동률, 통계
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine } from '../public/js/sim/build.js';
import { setSupplyItem } from '../public/js/sim/station.js';
import { insertSorted, makeBeltItem } from '../public/js/sim/conveyor.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { utilization, perMinute, earnedPerMinute } from '../public/js/sim/stats.js';
import { loadRules } from './helpers.js';

const baseRules = loadRules();
// 시작 배치는 출고구만 두고 비운다 (테스트가 직접 짓는다)
const rules = { ...baseRules, game: { ...baseRules.game, stations: baseRules.game.stations.filter((s) => s.type === 'counter') } };
const dt = 1 / rules.game.ticksPerSecond;
const R = 0, D = 1, L = 2;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };

function automationWorld() {
  const w = createWorld(rules);
  w.stats.sold.burger = 6;
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 1.5, prevX: 15.5, prevY: 1.5 });
  w.money = 1000; // 입고구 원료 값
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
  // 번: 밀밭 → 제분기 → 반죽기 → 오븐 → 벨트 → 조립기(위)
  build(w, 'wheat_field', 1, 3); // (1,3)-(2,4)
  build(w, 'inserter', 3, 4, R);
  build(w, 'mill', 4, 4);
  build(w, 'inserter', 5, 4, R);
  build(w, 'mixer', 6, 4);
  build(w, 'inserter', 7, 4, R);
  build(w, 'oven', 8, 4);
  build(w, 'inserter', 8, 5, D);
  build(w, 'belt', 8, 6, R);
  build(w, 'belt', 9, 6, D);
  build(w, 'inserter', 9, 7, D);
  // 양상추: 채소밭 → 세척기 → 조립기(위)
  build(w, 'lettuce_field', 10, 3); // (10,3)-(11,4)
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
  const s = supply(w, 5, 9, 'raw_meat');
  assert.equal(setSupplyItem(rules, s, 'flour'), false, '밀가루는 밭에서 (입고 목록에 없음)');
  run(w, secs(rules.machines.supply.seconds * 2 + 0.1));
  assert.deepEqual(s.output, ['raw_meat', 'raw_meat']);
  run(w, secs(60));
  assert.equal(s.output.length, rules.machines.supply.outputCap);
  assert.equal(s.status, 'blocked');
});

test('원료 값: 들여올 때마다 돈을 내고, 모자라면 기다린다. 수익은 원료 값을 뺀다', () => {
  const w = automationWorld();
  const buy = rules.items.raw_meat.buy;
  assert.ok(buy > 0);
  w.chapters.ended = true; // 장 보상이 끼지 않게
  w.money = buy; // 한 개 값만
  const s = supply(w, 5, 9, 'raw_meat');
  run(w, secs(rules.machines.supply.seconds * 3 + 0.1));
  assert.deepEqual(s.output, ['raw_meat'], '돈이 떨어지면 더 들여오지 않는다');
  assert.equal(w.money, 0);
  assert.ok(s.short);
  assert.equal(w.stats.spent, buy);
  assert.equal(earnedPerMinute(w), -buy * 6, '수익 = 판 돈 - 원료 값 (1분 기준으로 환산)');
  w.money = 100;
  run(w, secs(rules.machines.supply.seconds + 0.1));
  assert.equal(s.output.length, 2, '돈이 생기면 다시');
  assert.ok(!s.short);
  // 물처럼 값이 없는 원료는 그냥 들여온다
  assert.equal(rules.items.water.buy ?? 0, 0);
});

test('입고 → 햄버거 → 판매까지 사람 손 없이 흐른다', () => {
  const w = automationWorld();
  buildBurgerLine(w);
  const money0 = w.money;
  run(w, secs(150));
  const burgers = w.stats.sold.burger - 6;
  assert.ok(burgers >= 10, `2분 30초 동안 판 햄버거 ${burgers}개`);
  // 15개를 넘기면 시장/주문이 열려 시세가 ±20% 움직인다
  assert.ok(w.money - money0 >= burgers * rules.items.burger.price * 0.8, `수입 ${w.money - money0}`);
  assert.equal(w.tutorial.log['made:burger_assembler'], true, '튜토리얼: 기계가 햄버거를 만듦');

  // 통계: 분당 생산/판매가 잡힌다
  const rates = perMinute(w);
  assert.ok(rates.burger.produced > 0 && rates.burger.sold > 0, JSON.stringify(rates.burger));
  assert.ok(rates.flour.consumed >= rates.dough.produced * 2 - 2, '밀가루 2개 → 반죽 1개');
  assert.ok(rates.wheat.produced > 0, '밀은 밭에서 자란다');
});

test('병목: 번 줄(밀밭이 원료)이 가장 느려서 조립기는 번을 기다린다 (가동률로 보인다)', () => {
  const w = automationWorld();
  const assembler = buildBurgerLine(w);
  run(w, secs(90));
  const oven = stationAt(w, 8, 4);
  const uOven = utilization(oven, 60);
  const uAsm = utilization(assembler, 60);
  assert.ok(uOven.running > 0.3, `오븐 가동 ${uOven.running}`);
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
  const s = supply(w, 5, 9, 'raw_meat');
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

test('밸런스: 기본 버거 라인 하나로 2장 목표(분당 햄버거)를 넘고, 7개면 8장 목표에 닿는다', () => {
  const w = automationWorld();
  buildBurgerLine(w);
  run(w, secs(120));
  const s0 = w.stats.sold.burger ?? 0;
  run(w, secs(120));
  const rate = ((w.stats.sold.burger ?? 0) - s0) / 2;
  const goal = (id) => rules.chapters.find((c) => c.id === id).goals.find((g) => g.kind === 'rate').n;
  assert.ok(rate >= goal('kitchen'), `분당 ${rate}`);
  // 잘 다듬은 라인은 오븐(분당 12) 한도까지, 기본 라인은 그보다 조금 아래
  assert.ok(rate * 7 >= goal('empire'), `분당 ${rate} × 7 < ${goal('empire')}`);
});
