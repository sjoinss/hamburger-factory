// 구역: 시작 방 둘레에 붙는 잠긴 구역들 (사각형). 돈 + 부품으로 사면 바닥이 열리고, 이미 가진 곳과 맞닿은 벽이 트인다.
import { TILE, getTile, setTile } from './grid.js';
import { missingCost, spendParts } from './parts.js';

const inRect = (z, x, y) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;

/** 이 칸이 속한 '산' 구역의 특성 { kind, mult, … } (시작 방이나 안 산 구역이면 null) */
export function zoneTraitAt(world, rules, x, y) {
  for (const z of rules.zones.zones) {
    if (inRect(z, x, y)) return world.zonesBought.includes(z.id) ? z.trait : null;
  }
  return null;
}

/** 기계가 놓인 구역 효과 배율 (예: 창고동의 호퍼 → 1.5). 해당 없으면 1. */
export function zoneMult(world, rules, station, kind) {
  const t = zoneTraitAt(world, rules, station.x, station.y);
  return t && t.kind === kind ? t.mult : 1;
}

/** 구역 작업 속도 배율: 'speed' 구역에 놓인, 목록에 든 기계만 */
export function zoneSpeed(world, rules, station) {
  const t = zoneTraitAt(world, rules, station.x, station.y);
  return t && t.kind === 'speed' && t.machines.includes(station.type) ? t.mult : 1;
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

/**
 * 구역 바닥을 열고, 둘레 벽 중 건너편이 이미 바닥인 줄을 튼다 (매입, 저장 불러오기).
 * 순서와 상관없이 맞닿은 두 구역을 다 가지면 사이 벽이 트인다.
 */
export function openZone(world, rules, z) {
  if (!world.zonesBought.includes(z.id)) world.zonesBought.push(z.id);
  const g = world.grid;
  for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) setTile(g, x, y, TILE.FLOOR);
  const sides = [
    { from: z.y, to: z.y + z.h, at: (i) => [z.x - 1, i], beyond: (i) => [z.x - 2, i] },
    { from: z.y, to: z.y + z.h, at: (i) => [z.x + z.w, i], beyond: (i) => [z.x + z.w + 1, i] },
    { from: z.x, to: z.x + z.w, at: (i) => [i, z.y - 1], beyond: (i) => [i, z.y - 2] },
    { from: z.x, to: z.x + z.w, at: (i) => [i, z.y + z.h], beyond: (i) => [i, z.y + z.h + 1] },
  ];
  for (const s of sides) {
    for (let i = s.from; i < s.to; i++) {
      const [wx, wy] = s.at(i);
      const [bx, by] = s.beyond(i);
      if (getTile(g, wx, wy) === TILE.WALL && getTile(g, bx, by) === TILE.FLOOR) setTile(g, wx, wy, TILE.FLOOR);
    }
  }
  world.stationsVersion += 1;
}

/** 지금 쓸 수 있는 공장의 오른쪽·아래 끝 (칸 수, 벽 포함). 그 너머로는 카메라가 가지 않는다. */
export function ownedBounds(world, rules) {
  const { roomWidth, roomHeight, wallThickness: wall, streetRows = 0 } = rules.game.map;
  let w = roomWidth + wall * 2;
  let h = roomHeight + wall * 2 + streetRows;
  for (const z of rules.zones.zones) {
    if (!world.zonesBought.includes(z.id)) continue;
    w = Math.max(w, z.x + z.w + wall);
    h = Math.max(h, z.y + z.h + wall);
  }
  return { w: Math.min(w, world.grid.width), h: Math.min(h, world.grid.height) };
}
