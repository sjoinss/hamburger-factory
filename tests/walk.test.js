// 모바일 탭 이동: 길찾기와 걷기 입력
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { findPath, stationApproaches } from '../public/js/sim/path.js';
import { facingTile } from '../public/js/sim/interact.js';
import { stationAt } from '../public/js/sim/lookup.js';
import { createWalker } from '../public/js/ui/walk.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;

/** 걷기 입력을 넣으며 도착할 때까지 (최대 seconds) */
function walk(w, walker, seconds = 20) {
  for (let i = 0; i < seconds / dt; i++) {
    const auto = walker.intent();
    stepWorld(w, { ...NO_INPUT, ...(auto ?? {}) }, dt, rules);
    if (!walker.active() && !auto) return i;
  }
  return -1;
}
const tile = (w) => ({ x: Math.floor(w.player.x), y: Math.floor(w.player.y) });

test('길찾기: 막힌 칸을 돌아가고, 갈 수 없으면 null', () => {
  const w = createWorld(rules);
  const p = findPath(w.grid, { x: 8, y: 8 }, [{ x: 8, y: 4 }]);
  assert.ok(p && p.length >= 4);
  for (const c of p) assert.ok(!stationAt(w, c.x, c.y), `기계 칸을 지나지 않음 ${c.x},${c.y}`);
  assert.equal(findPath(w.grid, { x: 8, y: 8 }, [{ x: 0, y: 0 }]), null, '벽');
  assert.deepEqual(findPath(w.grid, { x: 8, y: 8 }, [{ x: 8, y: 8 }]), [], '이미 도착');
});

test('기계 둘레의 설 수 있는 칸과 바라볼 방향', () => {
  const w = createWorld(rules);
  const table = stationAt(w, 11, 5); // 조립대 2x1
  const spots = stationApproaches(w.grid, table);
  assert.ok(spots.length >= 4);
  for (const s of spots) {
    assert.ok(!stationAt(w, s.x, s.y));
    const dx = [1, 0, -1, 0][s.face];
    const dy = [0, 1, 0, -1][s.face];
    assert.equal(stationAt(w, s.x + dx, s.y + dy), table, '그 방향을 보면 조립대');
  }
});

test('바닥을 탭하면 그 칸까지 걸어간다', () => {
  const w = createWorld(rules);
  const walker = createWalker({ world: w, rules });
  assert.ok(walker.walkTo(4, 10));
  assert.ok(walk(w, walker) > 0, '도착');
  assert.deepEqual(tile(w), { x: 4, y: 10 });
  assert.ok(Math.abs(w.player.x - 4.5) < 0.1 && Math.abs(w.player.y - 10.5) < 0.1, '칸 가운데');
});

test('기계를 탭하면 그 앞으로 가서 기계를 바라본다 (바로 작업 가능)', () => {
  const w = createWorld(rules);
  const walker = createWalker({ world: w, rules });
  const hearth = w.stations.find((s) => s.type === 'hearth');
  assert.ok(walker.walkToStation(hearth));
  assert.ok(walk(w, walker) > 0);
  const t = facingTile(w.player, rules.game.player.reach);
  assert.equal(stationAt(w, t.x, t.y), hearth);
});

test('길이 막히면 제자리에서 오래 버티지 않고 멈춘다', () => {
  const w = createWorld(rules);
  const walker = createWalker({ world: w, rules });
  assert.ok(walker.walkTo(8, 4));
  // 가는 중에 앞을 막아 버린다 (플레이어 바로 위 칸을 단단하게)
  w.grid.solid[7 * w.grid.width + 8] = true;
  w.grid.solid[7 * w.grid.width + 7] = true;
  w.grid.solid[7 * w.grid.width + 9] = true;
  const ticks = walk(w, walker, 10);
  assert.ok(ticks >= 0, '포기하고 멈춤');
  assert.equal(walker.active(), false);
});

test('갈 수 없는 곳은 거절', () => {
  const w = createWorld(rules);
  const walker = createWalker({ world: w, rules });
  assert.equal(walker.walkTo(0, 0), false);
  assert.equal(walker.active(), false);
});
