// 편의 기능: 되돌리기, 설정 복사, 벨트 흐름, 저장 시각
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { placeMachine, removeMachine } from '../public/js/sim/build.js';
import { createUndo, noteBuilt, noteRemoved, snapshotStation, undoLast, UNDO_MAX } from '../public/js/sim/undo.js';
import { readSettings, applySettings, settingsKind } from '../public/js/sim/presets.js';
import { beltFlow } from '../public/js/sim/flow.js';
import { upgradeStation } from '../public/js/sim/upgrade.js';
import { captureBlueprint, pasteBlueprint } from '../public/js/sim/blueprint.js';
import { setGateManual } from '../public/js/sim/gate.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { serializeWorld, loadWorld } from '../public/js/sim/save.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const run = (w, ticks) => { for (let i = 0; i < ticks; i++) stepWorld(w, NO_INPUT, dt, rules); };
const R = 0;
const D = 1;

function worldAt(burgers) {
  const w = createWorld(rules);
  w.stats.sold.burger = burgers;
  run(w, 1);
  Object.assign(w.player, { x: 15.5, y: 11.5, prevX: 15.5, prevY: 11.5 });
  w.orders.timer = 1e9;
  w.parts = { iron_plate: 500, gear: 200, heat_plate: 50, wire: 100, motor: 50, sensor: 20, circuit: 20 };
  w.money = 100000;
  return w;
}
function build(w, type, x, y, rot = 0) {
  const res = placeMachine(w, rules, type, x, y, rot);
  assert.ok(res.ok, `${type} @${x},${y}: ${res.reason}`);
  return res;
}
function remove(w, undo, x, y) {
  const snap = snapshotStation(rules, stationAt(w, x, y));
  const res = removeMachine(w, rules, x, y);
  assert.ok(res.ok);
  noteRemoved(undo, snap);
}

test('되돌리기: 지은 것은 철거되고 부품이 그대로 돌아온다. 끌어서 깐 줄은 한 번에', () => {
  const w = worldAt(25);
  const undo = createUndo();
  const plates = w.parts.iron_plate;
  noteBuilt(undo, [build(w, 'grill', 3, 9)]);
  const line = noteBuilt(undo, [build(w, 'belt', 3, 10, R)]);
  noteBuilt(undo, [build(w, 'belt', 4, 10, R)], line);
  noteBuilt(undo, [build(w, 'belt', 5, 10, R)], line);
  assert.equal(undo.stack.length, 2);

  assert.deepEqual(undoLast(w, rules, undo), { ok: true, kind: 'built', count: 3 });
  assert.equal(stationAt(w, 4, 10), null);
  assert.ok(stationAt(w, 3, 9), '그릴은 아직');
  assert.ok(undoLast(w, rules, undo).ok);
  assert.equal(stationAt(w, 3, 9), null);
  assert.equal(w.parts.iron_plate, plates, '부품 100% 환급');
  assert.equal(undoLast(w, rules, undo).reason, 'empty');
});

test('되돌리기: 철거는 같은 자리에 다시 짓고 설정과 등급을 돌려놓는다', () => {
  const w = worldAt(100);
  const undo = createUndo();
  const supply = build(w, 'supply', 3, 9).station;
  applySettings(w, rules, supply, { item: 'iron_ore' });
  upgradeStation(w, rules, supply);
  upgradeStation(w, rules, supply);
  const belt = build(w, 'belt', 4, 9, R);
  noteBuilt(undo, [belt]); // 철거 전에 지은 기록 (번호가 바뀌어도 따라가야 한다)

  remove(w, undo, 3, 9);
  assert.equal(stationAt(w, 3, 9), null);
  const res = undoLast(w, rules, undo);
  assert.ok(res.ok && res.kind === 'removed');
  const back = stationAt(w, 3, 9);
  assert.equal(back.type, 'supply');
  assert.equal(back.item, 'iron_ore');
  assert.equal(back.level, 2);

  // 막힌 자리면 그 기록은 버리고 알려 준다
  remove(w, undo, 3, 9);
  build(w, 'grill', 3, 9);
  assert.equal(undoLast(w, rules, undo).reason, 'blocked');
  assert.ok(undoLast(w, rules, undo).ok, '그 앞 기록(벨트)은 되돌릴 수 있다');
  assert.equal(stationAt(w, 4, 9), null);
});

test('되돌리기: 고속 벨트로 바꾼 것은 원래 벨트로, 청사진은 통째로', () => {
  const w = worldAt(100);
  const undo = createUndo();
  build(w, 'belt', 3, 9, D);
  const swap = build(w, 'fast_belt', 3, 9, R);
  noteBuilt(undo, [swap]);
  assert.ok(undoLast(w, rules, undo).ok);
  const st = stationAt(w, 3, 9);
  assert.equal(st.type, 'belt');
  assert.equal(st.rot, D, '방향도 원래대로');

  build(w, 'grill', 5, 9);
  build(w, 'inserter', 6, 9, R);
  const bp = { name: 'x', ...captureBlueprint(w, rules, 5, 9, 6, 9) };
  const before = w.stations.length;
  const res = pasteBlueprint(w, rules, bp, 5, 6);
  assert.ok(res.ok);
  noteBuilt(undo, res.placed);
  assert.equal(w.stations.length, before + 2);
  assert.deepEqual(undoLast(w, rules, undo), { ok: true, kind: 'built', count: 2 });
  assert.equal(w.stations.length, before);
});

test('되돌리기: 손이 모자라면 기다리고, 기록은 최근 것만 남긴다', () => {
  const w = worldAt(25);
  const undo = createUndo();
  const grill = build(w, 'grill', 3, 9);
  noteBuilt(undo, [grill]);
  grill.station.output.push('patty', 'patty', 'patty');
  assert.equal(undoLast(w, rules, undo).reason, 'items');
  assert.equal(undo.stack.length, 1, '기록은 남는다');

  for (let i = 0; i < UNDO_MAX + 5; i++) noteBuilt(undo, [grill]);
  assert.equal(undo.stack.length, UNDO_MAX);
});

test('설정 복사: 같은 종류에만, 해금 안 된 입고 품목은 거절', () => {
  const w = worldAt(25);
  const a = build(w, 'supply', 3, 9).station;
  const b = build(w, 'supply', 4, 9).station;
  const hopper = build(w, 'hopper', 6, 8).station;
  const gate = build(w, 'gate', 9, 8).station;
  assert.equal(settingsKind(rules, 'grill'), null);
  applySettings(w, rules, a, { item: 'coal' });
  assert.ok(applySettings(w, rules, b, readSettings(rules, a)));
  assert.equal(b.item, 'coal');
  assert.ok(!applySettings(w, rules, hopper, readSettings(rules, a)), '입고구 설정은 호퍼에 안 붙는다');
  assert.ok(!applySettings(w, rules, b, { item: 'syrup' }), '아직 안 열린 품목');

  setGateManual(gate, 'burger', 5, true);
  const g2 = build(w, 'gate', 12, 8).station;
  applySettings(w, rules, g2, readSettings(rules, gate));
  assert.deepEqual([g2.mode.item, g2.mode.count, g2.mode.repeat], ['burger', 5, true]);
});

test('벨트 흐름: 분배기에서 갈라지는 길, 끝 저장소, 투입기가 넣는 기계까지', () => {
  const w = worldAt(25);
  const start = build(w, 'belt', 2, 8, R).station;
  build(w, 'belt', 3, 8, R);
  build(w, 'splitter', 4, 8, R); // 위·아래로 나간다
  build(w, 'belt', 4, 7, 3);
  build(w, 'belt', 4, 9, D);
  const hopper = build(w, 'hopper', 4, 10).station; // 아래 벨트 끝
  const ins = build(w, 'inserter', 5, 7, R).station; // 위 벨트에서 집어
  const grill = build(w, 'grill', 6, 7).station; // 그릴에 넣는다
  const flow = beltFlow(w, rules, start);
  assert.equal(flow.path.length, 5);
  const ends = new Set(flow.ends.map((s) => s.id));
  assert.ok(ends.has(hopper.id) && ends.has(ins.id) && ends.has(grill.id));
  assert.equal(beltFlow(w, rules, grill), null, '벨트가 아니면 없음');
});

test('저장 시각: 저장 파일에 남고, 이상한 값은 버린다', () => {
  const w = createWorld(rules);
  assert.equal(loadWorld(rules, serializeWorld(w, 1760000000000)).savedAt, 1760000000000);
  assert.equal(loadWorld(rules, serializeWorld(w)).savedAt, null);
  const bad = JSON.parse(serializeWorld(w));
  bad.savedAt = 'yesterday';
  assert.equal(loadWorld(rules, JSON.stringify(bad)).savedAt, null);
});
