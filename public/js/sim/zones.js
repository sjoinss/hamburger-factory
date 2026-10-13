// 구역: 시작 방 오른쪽으로 잠긴 구역들. 돈 + 부품으로 사면 바닥이 열리고 사이 벽이 트인다.
import { TILE, getTile, setTile } from './grid.js';
import { missingCost, spendParts } from './parts.js';

/** 이 칸이 속한 '산' 구역의 특성 { kind, mult } (시작 방이나 안 산 구역이면 null) */
export function zoneTraitAt(world, rules, x) {
  for (const z of rules.zones.zones) {
    if (x >= z.x && x < z.x + z.w) return world.zonesBought.includes(z.id) ? z.trait : null;
  }
  return null;
}

/** 기계가 놓인 구역 효과 배율 (예: 창고동의 호퍼 → 1.5). 해당 없으면 1. */
export function zoneMult(world, rules, station, kind) {
  const t = zoneTraitAt(world, rules, station.x);
  return t && t.kind === kind ? t.mult : 1;
}

/**
 * 살 수 있는가. reason: locked(기능 미해금) | owned | requires | money | parts
 */
export function checkZone(world, rules, id) {
  const z = rules.zones.zones.find((x) => x.id === id);
  if (!z || !world.features.includes('zones')) return { ok: false, reason: 'locked', zone: z };
  if (world.zonesBought.includes(id)) return { ok: false, reason: 'owned', zone: z };
  if (z.requires && !world.zonesBought.includes(z.requires)) return { ok: false, reason: 'requires', zone: z };
  if (world.money < z.cost.money) return { ok: false, reason: 'money', zone: z, short: z.cost.money - world.money };
  const missing = missingCost(world, rules, z.cost.parts);
  if (Object.keys(missing).length) return { ok: false, reason: 'parts', zone: z, missing };
  return { ok: true, zone: z };
}

export function buyZone(world, rules, id) {
  const check = checkZone(world, rules, id);
  if (!check.ok) return check;
  const z = check.zone;
  world.money -= z.cost.money;
  spendParts(world, rules, z.cost.parts);
  openZone(world, rules, z);
  world.events.push({ type: 'zoneBought', zone: z.id });
  return check;
}

/** 구역 바닥을 열고 사이 벽을 튼다 (매입, 저장 불러오기) */
export function openZone(world, rules, z) {
  if (!world.zonesBought.includes(z.id)) world.zonesBought.push(z.id);
  const roomBottom = rules.game.map.roomHeight + rules.game.map.wallThickness;
  for (let y = 1; y < roomBottom; y++) {
    for (let x = z.x; x < z.x + z.w; x++) setTile(world.grid, x, y, TILE.FLOOR);
    // 왼쪽 벽 (앞 구역과 사이)을 터서 한 공장으로
    if (getTile(world.grid, z.x - 1, y) === TILE.WALL) setTile(world.grid, z.x - 1, y, TILE.FLOOR);
  }
  world.stationsVersion += 1;
}

/** 지금 쓸 수 있는 공장의 오른쪽 끝 (칸 수, 오른쪽 벽 포함). 그 너머는 그리지 않고 카메라도 가지 않는다. */
export function ownedWidth(world, rules) {
  const wall = rules.game.map.wallThickness;
  let right = rules.game.map.roomWidth + wall * 2;
  for (const z of rules.zones.zones) if (world.zonesBought.includes(z.id)) right = Math.max(right, z.x + z.w + wall);
  return Math.min(right, world.grid.width);
}
