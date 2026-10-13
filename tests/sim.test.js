import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../public/js/sim/world.js';
import { isSolid, getTile, TILE } from '../public/js/sim/grid.js';
import { validateAll } from '../public/js/data.js';
import { currentTutorialStep, tutorialTarget, skipTutorial, restartTutorial } from '../public/js/sim/tutorial.js';
import { loadRaw, loadRules } from './helpers.js';

const rules = loadRules();
const config = rules.game;
const dt = 1 / config.ticksPerSecond;

function run(world, input, ticks) {
  for (let i = 0; i < ticks; i++) stepWorld(world, { ...NO_INPUT, ...input }, dt, rules);
}

test('시작 방은 벽으로 둘러싸이고 작업대 칸은 막혀 있다', () => {
  const w = createWorld(rules);
  // 시작 방 오른쪽으로 잠긴 구역들이 이어져 있다 (벽 한 줄씩 사이)
  const zones = rules.zones.zones;
  assert.equal(w.grid.width, zones[zones.length - 1].x + zones[zones.length - 1].w + 1);
  assert.equal(getTile(w.grid, config.map.roomWidth + 1, 5), TILE.WALL, '시작 방 오른쪽 벽');
  assert.equal(getTile(w.grid, zones[0].x, 5), TILE.LOCKED, '아직 안 산 구역');
  assert.ok(isSolid(w.grid, zones[0].x, 5));
  assert.ok(isSolid(w.grid, 0, 0));
  assert.equal(w.stations.length, config.stations.length);
  for (const st of w.stations) {
    for (let y = st.y; y < st.y + st.h; y++) for (let x = st.x; x < st.x + st.w; x++) assert.ok(isSolid(w.grid, x, y));
  }
});

test('플레이어는 설정 속도로 이동한다', () => {
  const w = createWorld(rules);
  const x0 = w.player.x;
  run(w, { moveX: 1 }, config.ticksPerSecond); // 1초
  assert.ok(Math.abs(w.player.x - x0 - config.player.tilesPerSecond) < 1e-6);
  assert.equal(w.player.dir, 'right');
});

test('플레이어는 벽을 통과하지 못한다', () => {
  const w = createWorld(rules);
  w.player.x = w.player.prevX = 14.5; // 오른쪽 아래 빈 구역
  w.player.y = w.player.prevY = 10.5;
  run(w, { moveX: 1, moveY: 1 }, 400);
  const half = config.player.hitbox / 2;
  assert.ok(w.player.x + half <= w.grid.width - 1);
  assert.ok(w.player.y + half <= w.grid.height - 1);
});

test('대각선 이동은 정규화된다 (조이스틱 아날로그 값도 허용)', () => {
  const w = createWorld(rules);
  const { x, y } = w.player;
  run(w, { moveX: 1, moveY: 1 }, 1);
  assert.ok(Math.abs(Math.hypot(w.player.x - x, w.player.y - y) - config.player.tilesPerSecond * dt) < 1e-6);
  const w2 = createWorld(rules);
  run(w2, { moveX: 0.5, moveY: 0 }, 1);
  assert.ok(Math.abs(w2.player.x - x - 0.5 * config.player.tilesPerSecond * dt) < 1e-6);
});

// ── M1: 손으로 햄버거 만들기 ──

/** 작업대 앞에 서서 바라보게 한다 (걷기는 위 테스트에서 따로 확인) */
function standAt(world, x, y, dir) {
  Object.assign(world.player, { x: x + 0.5, y: y + 0.5, prevX: x + 0.5, prevY: y + 0.5, dir });
}
const press = (w) => run(w, { interactPressed: true, interactHeld: true }, 1);
/** E 를 누르고 seconds 동안 유지 */
function hold(w, seconds) {
  run(w, { interactPressed: true, interactHeld: true }, 1);
  run(w, { interactHeld: true }, Math.ceil(seconds / dt) - 1);
}
const secs = (recipeId, station) =>
  rules.recipes.find((r) => r.id === recipeId).seconds / rules.machines[station].speed;
const CRATE = rules.machines.crate.seconds;
const HARVEST = rules.machines.wheat_field.harvestSeconds;

test('손으로 햄버거를 만들어 출고구에 넣으면 돈이 오른다', () => {
  const w = createWorld(rules);

  standAt(w, 3, 2, 'left'); // 생고기 상자
  hold(w, CRATE);
  assert.deepEqual(w.player.inventory, ['raw_meat', null]);

  standAt(w, 5, 3, 'up'); // 도마: 올리고 그대로 누르고 있으면 썰기
  hold(w, secs('chop_meat', 'cutting_board'));
  press(w);
  assert.deepEqual(w.player.inventory, ['ground_meat', null]);

  standAt(w, 8, 3, 'up'); // 철판
  hold(w, secs('fry_patty', 'griddle_manual'));
  press(w);
  assert.deepEqual(w.player.inventory, ['patty', null]);

  standAt(w, 4, 4, 'left'); // 채소밭: 길게 눌러 수확
  hold(w, HARVEST);
  assert.deepEqual(w.player.inventory, ['patty', 'lettuce']);
  standAt(w, 5, 3, 'up');
  hold(w, secs('prep_lettuce', 'cutting_board'));
  press(w);
  assert.deepEqual(w.player.inventory, ['patty', 'lettuce_washed']);

  standAt(w, 11, 6, 'up'); // 조립대에 두 개 올리기
  press(w);
  press(w);
  assert.deepEqual(w.player.inventory, [null, null]);

  // 빵: 밀밭에서 수확 → 맷돌 → 반죽대 → 화덕
  standAt(w, 13, 1, 'right');
  hold(w, HARVEST * 2 + dt);
  assert.deepEqual(w.player.inventory, ['wheat', 'wheat']);
  standAt(w, 12, 3, 'up'); // 맷돌: 한 개씩 빻는다
  hold(w, secs('mill_wheat', 'hand_mill'));
  press(w);
  hold(w, secs('mill_wheat', 'hand_mill'));
  press(w);
  assert.deepEqual(w.player.inventory, ['flour', 'flour']);
  standAt(w, 13, 4, 'right'); // 반죽대: 두 개 올리고 반죽
  press(w);
  hold(w, secs('mix_dough', 'dough_table'));
  press(w);
  assert.deepEqual(w.player.inventory, ['dough', null]);
  standAt(w, 13, 6, 'right'); // 화덕
  hold(w, secs('bake_bun', 'hearth'));
  press(w);
  assert.deepEqual(w.player.inventory, ['bun', null]);
  standAt(w, 12, 6, 'up'); // 조립대 오른쪽 칸에서도 같은 조립대
  hold(w, secs('assemble_burger', 'assembly_table'));
  press(w);
  assert.deepEqual(w.player.inventory, ['burger', null]);

  standAt(w, 7, 11, 'down'); // 출고구
  press(w);
  assert.equal(w.money, rules.items.burger.price);
  assert.deepEqual(w.player.inventory, [null, null]);
  assert.equal(w.stats.sold.burger, 1);
  // 같은 순서로 하면 시작 튜토리얼이 끝나고, 첫 판매로 그릴이 해금되며 그릴 튜토리얼이 이어진다
  assert.equal(w.tutorial.track, 'grill');
  assert.equal(w.tutorial.active, true);
  assert.deepEqual(w.unlocked.machines, ['grill']);
});

test('작업은 누르고 있는 동안만 진행되고, 손을 떼도 진행도는 남는다', () => {
  const w = createWorld(rules);
  w.player.inventory[0] = 'raw_meat';
  standAt(w, 5, 3, 'up');
  hold(w, 1);
  const board = w.stations.find((s) => s.type === 'cutting_board');
  const p = board.progress;
  assert.ok(p > 0.9 && p < 1.1);
  run(w, {}, 40); // 손 뗌
  assert.equal(board.progress, p);
  assert.deepEqual(board.output, []);
});

test('엉뚱한 재료는 올라가지 않는다', () => {
  const w = createWorld(rules);
  w.player.inventory[0] = 'bun';
  standAt(w, 8, 3, 'up'); // 철판에 번
  press(w);
  assert.deepEqual(w.player.inventory, ['bun', null]);
  w.player.inventory[1] = 'bun';
  standAt(w, 11, 6, 'up'); // 조립대에 번 2개 → 1개만
  press(w);
  press(w);
  assert.deepEqual(w.player.inventory.filter(Boolean), ['bun']);
});

test('손은 2칸. 꽉 차면 상자에서 더 못 꺼낸다', () => {
  const w = createWorld(rules);
  standAt(w, 3, 2, 'left');
  hold(w, CRATE * 5);
  assert.deepEqual(w.player.inventory, ['raw_meat', 'raw_meat']);
});

test('재료는 팔 수 없고, Q 로 내려놓고 E 로 줍는다', () => {
  const w = createWorld(rules);
  w.player.inventory[0] = 'raw_meat';
  standAt(w, 7, 11, 'down');
  press(w);
  assert.equal(w.money, 0);
  assert.deepEqual(w.player.inventory, ['raw_meat', null]);

  standAt(w, 9, 8, 'right');
  run(w, { dropPressed: true }, 1);
  assert.deepEqual(w.groundItems, [{ x: 10, y: 8, item: 'raw_meat' }]);
  assert.deepEqual(w.player.inventory, [null, null]);
  run(w, { dropPressed: true }, 1); // 빈 손이면 아무 일 없음
  press(w);
  assert.deepEqual(w.groundItems, []);
  assert.deepEqual(w.player.inventory, ['raw_meat', null]);
});

test('시뮬레이션 상태는 JSON 직렬화 가능', () => {
  const w = createWorld(rules);
  w.player.inventory[0] = 'raw_meat';
  standAt(w, 5, 3, 'up');
  hold(w, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
});

test('잘못된 데이터는 거부한다', () => {
  const bad = (patch) => () => validateAll({ ...loadRaw(), ...patch });
  const raw = loadRaw();
  assert.throws(bad({ game: { ...raw.game, tileSize: 'big' } }));
  assert.throws(bad({ game: { ...raw.game, stations: [{ type: 'rocket', x: 1, y: 1 }] } }));
  assert.throws(bad({ game: JSON.parse('{"__proto__": {"x": 1}}') }));
  assert.throws(bad({ recipes: { recipes: [{ ...raw.recipes.recipes[0], inputs: { gold: 1 } }] } }));
  assert.throws(bad({ machines: { machines: { ...raw.machines.machines, crate: { ...raw.machines.machines.crate, kind: 'magic' } } } }));
});

test('튜토리얼 길잡이: 든 것과 작업대 상태를 보고 다음 갈 곳을 가리킨다', () => {
  const w = createWorld(rules);
  run(w, {}, 1);
  assert.equal(currentTutorialStep(w, rules).text, '햄버거 만들기');
  const at = () => tutorialTarget(w, rules)?.type;
  // 빈손: 모자란 재료가 나오는 곳 중 가장 가까운 곳 (시작 위치에서는 채소밭)
  assert.equal(at(), 'lettuce_field');
  Object.assign(w.player, { x: 3.5, y: 2.5 }); // 고기 상자 옆으로
  assert.equal(at(), 'crate');
  assert.equal(tutorialTarget(w, rules).item, 'raw_meat');
  w.player.inventory = ['raw_meat', null];
  assert.equal(at(), 'cutting_board', '생고기 → 도마');
  w.player.inventory = ['ground_meat', null];
  assert.equal(at(), 'griddle_manual', '다진고기 → 철판');
  w.player.inventory = ['patty', null];
  assert.equal(at(), 'assembly_table', '패티 → 조립대');
  const table = w.stations.find((s) => s.type === 'assembly_table');
  table.contents = ['patty'];
  w.player.inventory = [null, null];
  assert.equal(at(), 'lettuce_field', '패티를 올렸으면 다음 모자란 재료(양상추) 쪽');
  table.contents = ['patty', 'lettuce_washed'];
  assert.equal(at(), 'wheat_field', '번은 밀밭부터');
  Object.assign(w.player, { x: 8.5, y: 8.5 });
  w.player.inventory = ['wheat', null];
  assert.equal(at(), 'hand_mill');
  const dough = w.stations.find((s) => s.type === 'dough_table');
  dough.contents = ['flour'];
  w.player.inventory = [null, null];
  assert.equal(at(), 'wheat_field', '밀가루가 하나 더 필요');
  dough.contents = ['flour', 'flour'];
  assert.equal(at(), 'dough_table', '다 올렸으면 반죽하러');
  dough.contents = [];
  table.contents = ['patty', 'lettuce_washed', 'bun'];
  assert.equal(at(), 'assembly_table', '다 올렸으면 조립하러');
  w.player.inventory = ['burger', null];
  w.tutorial.log['have:burger'] = true; // 게임에서는 손에 들어올 때 기록된다
  run(w, {}, 1);
  assert.equal(currentTutorialStep(w, rules).text, '햄버거 팔기');
  assert.equal(at(), 'counter');
});

test('튜토리얼 건너뛰기 / 다시 하기', () => {
  const w = createWorld(rules);
  skipTutorial(w);
  assert.equal(currentTutorialStep(w, rules), null);
  assert.equal(tutorialTarget(w, rules), null);
  restartTutorial(w);
  assert.equal(w.tutorial.step, 0);
  assert.ok(currentTutorialStep(w, rules));
});

test('밭: 다 거두면 다시 자라고, 다 자라면 수확물이 생긴다', () => {
  const w = createWorld(rules);
  const field = w.stations.find((s) => s.type === 'wheat_field');
  const m = rules.machines.wheat_field;
  assert.equal(field.output.length, 0);
  run(w, {}, 1);
  assert.equal(field.output.length, m.yield, '처음엔 다 자란 채로 시작');
  field.output = [];
  run(w, {}, Math.ceil(m.growSeconds / dt) - 2);
  assert.equal(field.output.length, 0, '자라는 중');
  run(w, {}, 3);
  assert.deepEqual(field.output, new Array(m.yield).fill('wheat'));
});

test('밭: 손이 비어 있어야 수확, 수확은 길게 눌러야 한다', () => {
  const w = createWorld(rules);
  run(w, {}, 1);
  standAt(w, 13, 1, 'right');
  press(w);
  assert.deepEqual(w.player.inventory, [null, null], '한 번 누름으로는 수확 안 됨');
  hold(w, HARVEST);
  assert.deepEqual(w.player.inventory, ['wheat', null]);
});
