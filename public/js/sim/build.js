// 건설과 철거. 기계는 돈이 아니라 부품으로 짓는다.
import { TILE, getTile, getOccupant, inBounds, setOccupant } from './grid.js';
import { createStation, rotatedSize } from './station.js';
import { freeSlot, groundItemAt } from './interact.js';
import { noteTutorial } from './tutorial.js';
import { missingCost, spendParts } from './parts.js';
import { zoneMult } from './zones.js';

export function isUnlocked(world, type) {
  return world.unlocked.machines.includes(type);
}

/** 부족한 부품 { id: 부족한 수 } (없으면 빈 객체) */
export function missingParts(world, rules, type) {
  return missingCost(world, rules, rules.machines[type].cost);
}

function playerOverlaps(world, rules, x, y, w, h) {
  const p = world.player;
  const half = rules.game.player.hitbox / 2;
  return p.x + half > x && p.x - half < x + w && p.y + half > y && p.y - half < y + h;
}

/**
 * 이 자리에 지을 수 있는가.
 * reason: locked | outside | blocked | item | player | parts
 */
export function checkPlacement(world, rules, type, x, y, rot) {
  const machine = rules.machines[type];
  const [w, h] = rotatedSize(machine, rot);
  const base = { w, h };
  if (!machine.cost || !isUnlocked(world, type)) return { ...base, ok: false, reason: 'locked' };
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (!inBounds(world.grid, i, j)) return { ...base, ok: false, reason: 'outside' };
      if (getTile(world.grid, i, j) !== TILE.FLOOR || getOccupant(world.grid, i, j) !== null) {
        return { ...base, ok: false, reason: 'blocked' };
      }
      if (groundItemAt(world, i, j)) return { ...base, ok: false, reason: 'item' };
    }
  }
  if (!machine.walkable && playerOverlaps(world, rules, x, y, w, h)) return { ...base, ok: false, reason: 'player' };
  const missing = missingParts(world, rules, type);
  if (Object.keys(missing).length > 0) return { ...base, ok: false, reason: 'parts', missing };
  return { ...base, ok: true };
}

export function placeMachine(world, rules, type, x, y, rot = 0) {
  const check = checkPlacement(world, rules, type, x, y, rot);
  if (!check.ok) return check;
  spendParts(world, rules, rules.machines[type].cost);
  const id = world.nextStationId++;
  const station = createStation(id, { type, x, y, rot, built: true }, rules.machines[type]);
  if (rules.machines[type].kind === 'storage') station.capMult = zoneMult(world, rules, station, 'storage');
  world.stations.push(station);
  const solid = !rules.machines[type].walkable;
  for (let j = y; j < y + station.h; j++) for (let i = x; i < x + station.w; i++) setOccupant(world.grid, i, j, id, solid);
  world.stationsVersion += 1;
  world.stats.built[type] = (world.stats.built[type] ?? 0) + 1;
  noteTutorial(world, 'built', type);
  world.events.push({ type: 'built', machine: type, x, y });
  return { ...check, station };
}

/** 철거할 수 있는 기계 (플레이어가 지은 것만) */
export function removableAt(world, x, y) {
  const id = getOccupant(world.grid, x, y);
  if (id === null) return null;
  const st = world.stations.find((s) => s.id === id);
  return st && st.built ? st : null;
}

/**
 * 철거: 부품 100% 환급, 안에 든 물건은 플레이어 손으로.
 * 손에 다 들어가지 않으면 철거하지 않는다 (물건이 사라지지 않게).
 * reason: none | items
 */
export function removeMachine(world, rules, x, y) {
  const st = removableAt(world, x, y);
  if (!st) return { ok: false, reason: 'none' };
  const items = [
    ...st.contents, ...st.output,
    ...(st.items ?? []).map((it) => it.item),
    ...(st.buffer ? [st.buffer.item] : []),
    ...(st.held ? [st.held] : []),
  ];
  const free = world.player.inventory.filter((it) => it === null).length;
  if (items.length > free) return { ok: false, reason: 'items', count: items.length, free };

  for (const it of items) world.player.inventory[freeSlot(world.player)] = it;
  for (const [id, n] of Object.entries(rules.machines[st.type].cost)) {
    world.parts[id] = (world.parts[id] ?? 0) + n;
  }
  for (let j = st.y; j < st.y + st.h; j++) for (let i = st.x; i < st.x + st.w; i++) setOccupant(world.grid, i, j, null);
  world.stations = world.stations.filter((s) => s !== st);
  world.stationsVersion += 1;
  world.events.push({ type: 'removed', machine: st.type, x: st.x, y: st.y });
  return { ok: true, station: st };
}

/** 1×1 기계의 방향만 바꾼다 (끌어서 벨트를 깔 때 앞 칸 방향 맞추기). 부품 변화 없음. */
export function rotateStation(world, rules, station, rot) {
  if (!station.built || station.w !== 1 || station.h !== 1) return false;
  if (station.rot === rot) return true;
  station.rot = rot;
  // 벨트 위 물건은 새 방향 기준으로 위치만 다시 계산된다
  world.stationsVersion += 1;
  return true;
}
