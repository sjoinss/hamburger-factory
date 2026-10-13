// 기계 조회 색인. 기계가 바뀔 때(world.stationsVersion) 다시 만든다. 상태에는 저장하지 않는다.
import { getOccupant } from './grid.js';

const cache = new WeakMap();

function index(world) {
  let c = cache.get(world);
  if (!c || c.version !== world.stationsVersion || c.stations !== world.stations) {
    c = { version: world.stationsVersion, stations: world.stations, byId: new Map(world.stations.map((s) => [s.id, s])) };
    cache.set(world, c);
  }
  return c.byId;
}

export function stationById(world, id) {
  return index(world).get(id) ?? null;
}

export function stationAt(world, x, y) {
  const id = getOccupant(world.grid, x, y);
  return id === null ? null : stationById(world, id);
}

/** 방향 0=오른쪽, 1=아래, 2=왼쪽, 3=위 (시계 방향) */
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
