// M8: 챕터 목표와 엔딩
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { goalStatus, currentChapter, RATE_MIN_SECONDS } from '../public/js/sim/chapters.js';
import { receiveAtCounter } from '../public/js/sim/orders.js';
import { record } from '../public/js/sim/stats.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { serializeWorld, loadWorld } from '../public/js/sim/save.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const secs = (s) => Math.ceil(s / dt);
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };
const counter = (w) => stationAt(w, 7, 12);
const events = (w, type) => w.events.filter((e) => e.type === type);

test('1장: 햄버거 5개를 팔면 끝나고 보상, 다음 장으로', () => {
  const w = createWorld(rules);
  assert.equal(currentChapter(w, rules).id, 'open');
  for (let i = 0; i < 4; i++) receiveAtCounter(w, rules, 'burger', counter(w));
  run(w, secs(1.1));
  assert.equal(w.chapters.index, 0);
  receiveAtCounter(w, rules, 'burger', counter(w));
  const money = w.money;
  w.events.length = 0;
  run(w, secs(1.1));
  assert.equal(w.chapters.index, 1);
  assert.equal(w.money - money, rules.chapters[0].reward.money);
  assert.equal(events(w, 'chapterDone').length, 1);
});

test('분당 목표는 1분이 지나야 인정한다', () => {
  const w = createWorld(rules);
  w.chapters.index = 1; // 2장: 버거 조립기 + 분당 햄버거 4
  record(w, 'sold', 'burger', 10);
  const rate = rules.chapters[1].goals.find((g) => g.kind === 'rate');
  const early = goalStatus(w, rules, rate);
  assert.ok(early.have >= rate.n);
  assert.equal(early.done, false);
  w.time = RATE_MIN_SECONDS;
  record(w, 'sold', 'burger', 10);
  assert.equal(goalStatus(w, rules, rate).done, true);
});

test('주문 수 집계: 완료/실패/인식기/묶음', () => {
  const w = createWorld(rules);
  w.features.push('orders');
  w.orders.timer = 1e9;
  const add = (items, extra = {}) => {
    const o = { id: w.orders.nextId++, kind: 'normal', items, delivered: {}, reward: 10, createdAt: 0, deadline: w.time + 1, state: 'open', leaveAt: null, look: { hair: 0, shirt: 0, seed: 0 }, auto: false, ...extra };
    w.orders.list.push(o);
    return o;
  };
  const a = add({ burger: 1 }, { auto: true });
  receiveAtCounter(w, rules, 'burger', counter(w), a.id);
  const b = add({ burger: 1, patty: 1 });
  receiveAtCounter(w, rules, 'order_bag', counter(w), b.id, { burger: 1, patty: 1 });
  add({ burger: 2 });
  run(w, secs(1.5));
  assert.deepEqual(w.stats.orders, { done: 2, failed: 1, auto: 1, bundled: 1 });
});

test('마지막 장을 끝내면 엔딩, 그 뒤로는 그대로 샌드박스', () => {
  const w = createWorld(rules);
  w.chapters.index = rules.chapters.length - 1;
  w.reputation = 1000;
  w.time = 120;
  record(w, 'sold', 'burger', 100);
  run(w, secs(1.1));
  assert.equal(w.chapters.ended, true);
  assert.equal(events(w, 'ending').length, 1);
  assert.equal(currentChapter(w, rules), null);
  w.events.length = 0;
  run(w, secs(5));
  assert.equal(events(w, 'ending').length, 0, '엔딩은 한 번만');
  const { world: loaded } = loadWorld(rules, serializeWorld(w));
  assert.deepEqual(loaded.chapters, w.chapters);
});

test('조건을 이미 채웠으면 여러 장을 한 번에 넘어간다', () => {
  const w = createWorld(rules);
  w.stats.sold.burger = 10;
  w.stats.orders.done = 10;
  w.reputation = 10;
  run(w, secs(1.1));
  // 1장(판매)만 채움. 2장은 버거 조립기가 없어서 멈춘다
  assert.equal(currentChapter(w, rules).id, 'kitchen');
});
