// 시뮬레이션 상태 전체. 직렬화 가능한 순수 데이터로 유지한다.
import { createRoomGrid, isSolid, setOccupant } from './grid.js';
import { createPlayer, updatePlayer } from './player.js';
import { createStation, updateMachine } from './station.js';
import { updateInteraction } from './interact.js';
import { createTutorial, updateTutorial, noteTutorial } from './tutorial.js';
import { updateProgression } from './progression.js';
import { updateInserter } from './inserter.js';
import { updateConveyors } from './conveyor.js';

export const NO_INPUT = Object.freeze({
  moveX: 0, moveY: 0, interactPressed: false, interactHeld: false, dropPressed: false,
});

/** @param rules data.js buildRules() 결과 */
export function createWorld(rules) {
  const config = rules.game;
  const { roomWidth, roomHeight, wallThickness } = config.map;
  const grid = createRoomGrid(roomWidth, roomHeight, wallThickness);

  const stations = [];
  for (const def of config.stations) {
    const machine = rules.machines[def.type];
    const [w, h] = machine.size;
    let free = true;
    for (let y = def.y; y < def.y + h; y++) for (let x = def.x; x < def.x + w; x++) if (isSolid(grid, x, y)) free = false;
    if (!free) continue; // 겹치거나 벽 위면 건너뛴다
    const station = createStation(stations.length + 1, def, machine);
    stations.push(station);
    for (let y = def.y; y < def.y + h; y++) for (let x = def.x; x < def.x + w; x++) setOccupant(grid, x, y, station.id);
  }

  return {
    version: 5,
    tick: 0,
    time: 0,
    money: 0,
    reputation: 0,
    grid,
    stations,
    nextStationId: stations.length + 1,
    // 기계 배치가 바뀔 때마다 올린다 (조회 색인·벨트 연결 다시 계산)
    stationsVersion: 0,
    groundItems: [],
    player: createPlayer(config.playerStart.x, config.playerStart.y, config.player.carryCapacity),
    stats: { sold: {}, earned: 0, built: {} },
    parts: { ...rules.progression.start.parts },
    unlocked: {
      recipes: [...rules.progression.start.recipes],
      machines: [...rules.progression.start.machines],
    },
    stagesDone: [],
    tutorial: createTutorial(rules.progression.start.tutorial),
    // 렌더/사운드가 읽고 비우는 일회성 사건 목록
    events: [],
  };
}

/** 고정 타임스텝 한 번. input 은 순수 데이터. */
export function stepWorld(world, input, dt, rules) {
  world.tick += 1;
  world.time += dt;
  updatePlayer(world.player, world.grid, input, dt, rules.game.player);
  updateInteraction(world, rules, input, dt);
  for (const st of world.stations) {
    if (rules.machines[st.type].kind === 'inserter') updateInserter(world, rules, st, dt);
  }
  updateConveyors(world, rules, dt);
  for (const st of world.stations) {
    if (rules.machines[st.type].kind !== 'machine') continue;
    if (updateMachine(rules, st, dt)) {
      noteTutorial(world, 'made', st.type);
      world.events.push({ type: 'made', machine: st.type, item: st.output[st.output.length - 1], x: st.x, y: st.y });
    }
  }
  updateTutorial(world, rules);
  updateProgression(world, rules);
}
