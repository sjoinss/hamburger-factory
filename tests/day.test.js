// 하루 결산: dayMinutes 마다 그날 판매·수익·주문을 한 줄로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { receiveAtCounter } from '../public/js/sim/orders.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { serializeWorld, loadWorld } from '../public/js/sim/save.js';
import { daySummaryText } from '../public/js/ui/stats.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const run = (w, seconds) => { for (let i = 0; i < Math.ceil(seconds / dt); i++) stepWorld(w, NO_INPUT, dt, rules); };
const DAY = rules.game.dayMinutes * 60;

test('하루가 지나면 그날 판매·수익을 결산하고 다음 날로', () => {
  const w = createWorld(rules);
  w.orders.timer = 1e9;
  run(w, DAY - 5);
  for (let i = 0; i < 3; i++) receiveAtCounter(w, rules, 'burger', stationAt(w, 7, 12));
  const earned = w.stats.earned;
  w.events.length = 0;
  run(w, 6);
  const ev = w.events.find((e) => e.type === 'dayEnd');
  assert.ok(ev, '첫날 결산');
  assert.equal(ev.day, 1);
  assert.equal(ev.sold, 3);
  assert.equal(ev.earned, Math.round(earned));
  assert.equal(w.day.n, 2);
  assert.deepEqual(w.day.last, { day: 1, sold: 3, earned: ev.earned, orders: 0, failed: 0 });

  // 둘째 날은 첫날 것을 빼고 센다
  receiveAtCounter(w, rules, 'burger', stationAt(w, 7, 12));
  w.events.length = 0;
  run(w, DAY);
  assert.equal(w.events.find((e) => e.type === 'dayEnd').sold, 1);
});

test('하루는 저장된다. 하루가 없던 옛 저장은 불러온 때부터 첫날', () => {
  const w = createWorld(rules);
  w.orders.timer = 1e9;
  run(w, DAY + 1);
  const back = loadWorld(rules, serializeWorld(w)).world;
  assert.deepEqual(back.day, w.day);

  const old = JSON.parse(serializeWorld(w));
  delete old.world.day;
  old.world.stats.sold = { burger: 50 };
  const fresh = loadWorld(rules, JSON.stringify(old)).world;
  assert.equal(fresh.day.n, 1);
  assert.equal(fresh.day.base.sold, 50, '불러오기 전 판매는 첫날에 넣지 않는다');
  assert.equal(fresh.day.start, fresh.time);
});

test('결산 한 줄: 주문·놓친 주문은 있을 때만', () => {
  assert.equal(daySummaryText({ sold: 3, earned: 36, orders: 0, failed: 0 }), '판매 3 · 수익 +36');
  assert.equal(daySummaryText({ sold: 9, earned: 200, orders: 2, failed: 1 }), '판매 9 · 수익 +200 · 주문 2건 · 놓친 주문 1');
});
