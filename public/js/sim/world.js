// 시뮬레이션 상태 전체. 직렬화 가능한 순수 데이터로 유지한다.
import { createRoomGrid, isSolid, setOccupant } from './grid.js';
import { createPlayer, updatePlayer } from './player.js';
import { createStation, updateMachine, updateSupply, updateFarm } from './station.js';
import { createStats, recordRecipe, record, sampleHistory } from './stats.js';
import { updateInteraction } from './interact.js';
import { createTutorial, updateTutorial, noteTutorial } from './tutorial.js';
import { updateProgression } from './progression.js';
import { updateInserter } from './inserter.js';
import { updateConveyors } from './conveyor.js';
import { updateGate } from './gate.js';
import { createMarket, updateMarket } from './market.js';
import { createOrders, updateOrders } from './orders.js';
import { TILE, getTile, setTile } from './grid.js';
import { createPower, updatePower } from './power.js';
import { zoneMult } from './zones.js';

export const NO_INPUT = Object.freeze({
  moveX: 0, moveY: 0, interactPressed: false, interactHeld: false, dropPressed: false,
});

/** @param rules data.js buildRules() 결과 */
export function createWorld(rules) {
  const config = rules.game;
  const { roomWidth, roomHeight, wallThickness } = config.map;
  const grid = createRoomGrid(roomWidth, roomHeight, wallThickness, config.map.streetRows ?? 0, rules.zones?.zones ?? []);

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

  // 출고구 바로 뒤(아래) 벽은 손님이 주문하는 창구
  for (const st of stations) {
    if (rules.machines[st.type].kind !== 'counter') continue;
    for (let x = st.x; x < st.x + st.w; x++) {
      if (getTile(grid, x, st.y + st.h) === TILE.WALL) setTile(grid, x, st.y + st.h, TILE.WINDOW);
    }
  }

  return {
    version: 8,
    rng: 20261013, // 난수 씨앗 (rng.js)
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
    stats: createStats(),
    parts: { ...rules.progression.start.parts },
    unlocked: {
      recipes: [...rules.progression.start.recipes],
      machines: [...rules.progression.start.machines],
      supplies: [...(rules.progression.start.supplies ?? [])],
    },
    zonesBought: [],
    power: createPower(),
    stagesDone: [],
    features: [...(rules.progression.start.features ?? [])],
    market: createMarket(),
    orders: createOrders(),
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
  // 전력: 모자라면 기계가 모두 같은 비율로 느려진다 (사람 손 작업은 그대로)
  updatePower(world, rules, dt);
  const pdt = dt * world.power.ratio;
  updateInteraction(world, rules, input, dt);
  for (const st of world.stations) {
    const kind = rules.machines[st.type].kind;
    if (kind === 'inserter') updateInserter(world, rules, st, pdt);
    else if (kind === 'gate') updateGate(world, rules, st, pdt);
  }
  updateConveyors(world, rules, dt);
  for (const st of world.stations) {
    const kind = rules.machines[st.type].kind;
    if (kind === 'farm') {
      if (updateFarm(rules, st, dt)) record(world, 'produced', rules.machines[st.type].crop, rules.machines[st.type].yield);
      continue;
    }
    if (kind === 'supply') {
      const item = updateSupply(rules, st, pdt, zoneMult(world, rules, st, 'supply'));
      if (item) record(world, 'produced', item);
      continue;
    }
    if (kind !== 'machine') continue;
    const done = updateMachine(rules, st, pdt);
    if (done) {
      recordRecipe(world, done);
      noteTutorial(world, 'made', st.type);
      world.events.push({ type: 'made', machine: st.type, item: st.output[st.output.length - 1], x: st.x, y: st.y });
    }
  }
  // 1초마다 기계 상태 기록 (최근 60초 가동률)
  if (world.tick % rules.game.ticksPerSecond === 0) {
    for (const st of world.stations) if (st.hist !== undefined) sampleHistory(st);
  }
  updateMarket(world, rules, dt);
  updateOrders(world, rules, dt);
  updateTutorial(world, rules);
  updateProgression(world, rules);
}
