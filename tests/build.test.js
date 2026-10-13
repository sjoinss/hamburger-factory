// M2: 첫 기계(그릴)와 건설
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { checkPlacement, placeMachine, removeMachine } from '../public/js/sim/build.js';
import { isSolid } from '../public/js/sim/grid.js';
import { currentTutorialStep } from '../public/js/sim/tutorial.js';
import { loadRules } from './helpers.js';

const rules = loadRules();
const dt = 1 / rules.game.ticksPerSecond;
const GRILL_COST = rules.machines.grill.cost;
const FRY_SECONDS = rules.recipes.find((r) => r.id === 'fry_patty').seconds / rules.machines.grill.speed;

function run(world, input, ticks) {
  for (let i = 0; i < ticks; i++) stepWorld(world, { ...NO_INPUT, ...input }, dt, rules);
}
function standAt(world, x, y, dir) {
  Object.assign(world.player, { x: x + 0.5, y: y + 0.5, prevX: x + 0.5, prevY: y + 0.5, dir });
}
const press = (w) => run(w, { interactPressed: true, interactHeld: true }, 1);

/** 첫 햄버거를 판 것처럼 만들어 그릴 단계를 연다 */
function unlockedWorld() {
  const w = createWorld(rules);
  w.stats.sold.burger = 1;
  run(w, {}, 1);
  return w;
}

test('처음에는 그릴을 지을 수 없고, 첫 햄버거를 팔면 해금 + 부품 보상', () => {
  const w = createWorld(rules);
  assert.equal(checkPlacement(w, rules, 'grill', 10, 9, 0).reason, 'locked');
  assert.deepEqual(w.parts, {});

  w.stats.sold.burger = 1;
  run(w, {}, 1);
  assert.deepEqual(w.unlocked.machines, ['grill']);
  assert.deepEqual(w.parts, rules.progression.stages[0].reward.parts);
  assert.equal(w.tutorial.track, 'grill');
  assert.equal(currentTutorialStep(w, rules).done.built, 'grill');

  run(w, {}, 5); // 같은 단계는 한 번만
  assert.deepEqual(w.parts, rules.progression.stages[0].reward.parts);
});

test('그릴을 지으면 부품이 소모되고 칸이 막힌다', () => {
  const w = unlockedWorld();
  const before = { ...w.parts };
  const res = placeMachine(w, rules, 'grill', 10, 9, 0);
  assert.equal(res.ok, true);
  for (const [id, n] of Object.entries(GRILL_COST)) assert.equal(w.parts[id], before[id] - n);
  assert.ok(isSolid(w.grid, 10, 9));
  assert.equal(w.stats.built.grill, 1);
  run(w, {}, 1);
  assert.equal(w.tutorial.step, 1, '튜토리얼: 짓기 단계 통과');
});

test('놓을 수 없는 자리와 부품 부족', () => {
  const w = unlockedWorld();
  assert.equal(checkPlacement(w, rules, 'grill', 0, 5, 0).reason, 'blocked'); // 벽
  assert.equal(checkPlacement(w, rules, 'grill', 2, 2, 0).reason, 'blocked'); // 상자
  assert.equal(checkPlacement(w, rules, 'grill', -1, 5, 0).reason, 'outside');
  assert.equal(checkPlacement(w, rules, 'grill', 8, 8, 0).reason, 'player'); // 플레이어 시작 칸
  w.groundItems.push({ x: 12, y: 9, item: 'bun' });
  assert.equal(checkPlacement(w, rules, 'grill', 12, 9, 0).reason, 'item');

  // 부품은 그릴 2대 분량. 3대째는 부족 (부족한 수도 알려 준다)
  assert.ok(placeMachine(w, rules, 'grill', 10, 9, 0).ok);
  assert.ok(placeMachine(w, rules, 'grill', 11, 9, 0).ok);
  const third = checkPlacement(w, rules, 'grill', 14, 9, 0);
  assert.equal(third.reason, 'parts');
  assert.deepEqual(third.missing, GRILL_COST);
});

test('그릴에 다진고기를 넣으면 누르고 있지 않아도 패티가 나온다', () => {
  const w = unlockedWorld();
  placeMachine(w, rules, 'grill', 10, 9, 0);
  const grill = w.stations.find((s) => s.type === 'grill');
  assert.equal(grill.status, 'idle');

  w.player.inventory = ['ground_meat', 'ground_meat'];
  standAt(w, 10, 8, 'down');
  press(w);
  press(w);
  assert.deepEqual(w.player.inventory, [null, null]);
  assert.equal(grill.contents.length, 2);

  run(w, {}, 2);
  assert.equal(grill.status, 'running');
  run(w, {}, Math.ceil(FRY_SECONDS / dt)); // 한 개 완성
  assert.deepEqual(grill.output, ['patty']);
  run(w, {}, Math.ceil(FRY_SECONDS / dt)); // 두 개째
  assert.deepEqual(grill.output, ['patty', 'patty']);
  assert.equal(grill.status, 'idle');
  assert.equal(currentTutorialStep(w, rules), null);
  assert.equal(w.tutorial.finished, true, '튜토리얼: 그릴로 패티를 구우면 그릴 트랙 완료');

  press(w);
  assert.deepEqual(w.player.inventory, ['patty', null]);
});

test('그릴은 다른 재료를 받지 않고, 입력은 정해진 만큼만 쌓인다', () => {
  const w = unlockedWorld();
  placeMachine(w, rules, 'grill', 10, 9, 0);
  const grill = w.stations.find((s) => s.type === 'grill');
  standAt(w, 10, 8, 'down');
  w.player.inventory = ['bun', null];
  press(w);
  assert.deepEqual(w.player.inventory, ['bun', null]);

  const limit = rules.machines.grill.inputBatches;
  for (let i = 0; i < limit + 2; i++) {
    w.player.inventory = ['ground_meat', null];
    press(w);
  }
  assert.equal(grill.contents.length, limit);
  assert.equal(w.player.inventory[0], 'ground_meat', '가득 차면 손에 남는다');
});

test('출력이 꽉 차면 막힘 상태로 멈춘다', () => {
  const w = unlockedWorld();
  placeMachine(w, rules, 'grill', 10, 9, 0);
  const grill = w.stations.find((s) => s.type === 'grill');
  grill.output = new Array(rules.machines.grill.outputCap).fill('patty');
  grill.contents = ['ground_meat'];
  run(w, {}, Math.ceil(FRY_SECONDS / dt) * 2);
  assert.equal(grill.status, 'blocked');
  assert.deepEqual(grill.contents, ['ground_meat']);
});

test('철거하면 부품 100% 환급, 안의 물건은 손으로. 손이 모자라면 철거 안 함', () => {
  const w = unlockedWorld();
  const start = { ...w.parts };
  placeMachine(w, rules, 'grill', 10, 9, 0);
  const grill = w.stations.find((s) => s.type === 'grill');
  grill.contents = ['ground_meat'];
  grill.output = ['patty', 'patty'];

  const refused = removeMachine(w, rules, 10, 9);
  assert.equal(refused.reason, 'items');
  assert.ok(w.stations.includes(grill));

  grill.output = ['patty'];
  const res = removeMachine(w, rules, 10, 9);
  assert.equal(res.ok, true);
  assert.deepEqual(w.parts, start);
  assert.deepEqual(w.player.inventory, ['ground_meat', 'patty']);
  assert.ok(!isSolid(w.grid, 10, 9));

  // 처음부터 있던 작업대는 철거할 수 없다
  assert.equal(removeMachine(w, rules, 5, 2).reason, 'none');
});

test('기계를 지은 상태도 JSON 직렬화 가능', () => {
  const w = unlockedWorld();
  placeMachine(w, rules, 'grill', 10, 9, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
});
