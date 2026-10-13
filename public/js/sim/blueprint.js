// 청사진: 지은 기계들을 영역째 저장했다가 다른 곳에 한 번에 짓는다.
// 설정(입고 품목, 호퍼 필터, 게이트 수동 설정)도 따라간다. 붙여넣을 때 부품은 한꺼번에 확인한다.
import { checkPlacement, placeMachine } from './build.js';
import { rotatedSize, setSupplyItem } from './station.js';
import { setStorageFilter } from './storage.js';
import { setGateManual } from './gate.js';
import { missingCost } from './parts.js';
import { noteTutorial } from './tutorial.js';

export const BLUEPRINT_MAX_ENTRIES = 400;
export const BLUEPRINT_MAX_SIZE = 64;
export const BLUEPRINT_NAME_MAX = 20;

/**
 * 두 모서리로 고른 영역 안에 '통째로' 들어오는 지은 기계들.
 * @returns { w, h, entries: [{ type, x, y, rot, item?, filter?, gate? }] } (기계가 없으면 null)
 */
export function captureBlueprint(world, rules, ax, ay, bx, by) {
  const x0 = Math.min(ax, bx);
  const y0 = Math.min(ay, by);
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const picked = world.stations.filter((st) =>
    st.built && st.x >= x0 && st.y >= y0 && st.x + st.w - 1 <= x1 && st.y + st.h - 1 <= y1);
  if (picked.length === 0) return null;
  const minX = Math.min(...picked.map((s) => s.x));
  const minY = Math.min(...picked.map((s) => s.y));
  const w = Math.max(...picked.map((s) => s.x + s.w)) - minX;
  const h = Math.max(...picked.map((s) => s.y + s.h)) - minY;
  if (w > BLUEPRINT_MAX_SIZE || h > BLUEPRINT_MAX_SIZE || picked.length > BLUEPRINT_MAX_ENTRIES) return null;
  const entries = picked
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((st) => {
      const e = { type: st.type, x: st.x - minX, y: st.y - minY, rot: st.rot };
      const kind = rules.machines[st.type].kind;
      if (kind === 'supply') e.item = st.item;
      if (kind === 'storage' && st.filter) e.filter = st.filter;
      if (kind === 'gate' && st.mode.kind === 'manual' && st.mode.item) {
        e.gate = { item: st.mode.item, count: st.mode.count, repeat: st.mode.repeat };
      }
      return e;
    });
  return { w, h, entries };
}

/** 청사진에 드는 부품 합계 */
export function blueprintCost(rules, bp) {
  const cost = {};
  for (const e of bp.entries) {
    for (const [id, n] of Object.entries(rules.machines[e.type].cost)) cost[id] = (cost[id] ?? 0) + n;
  }
  return cost;
}

/**
 * (ox, oy) 에 붙여넣을 수 있는가.
 * bad: 못 놓는 기계 번호들 / reason: blocked(자리) | locked(잠긴 기계) | parts(부품) | null
 */
export function checkBlueprint(world, rules, bp, ox, oy) {
  const bad = [];
  let locked = false;
  for (const [i, e] of bp.entries.entries()) {
    const c = checkPlacement(world, rules, e.type, ox + e.x, oy + e.y, e.rot);
    // 부품은 아래에서 합계로 본다
    if (!c.ok && c.reason !== 'parts') {
      bad.push(i);
      if (c.reason === 'locked') locked = true;
    }
  }
  const missing = missingCost(world, rules, blueprintCost(rules, bp));
  const short = Object.keys(missing).length > 0;
  const reason = locked ? 'locked' : bad.length ? 'blocked' : short ? 'parts' : null;
  return { ok: reason === null, reason, bad, missing };
}

export function pasteBlueprint(world, rules, bp, ox, oy) {
  const check = checkBlueprint(world, rules, bp, ox, oy);
  if (!check.ok) return check;
  for (const e of bp.entries) {
    const res = placeMachine(world, rules, e.type, ox + e.x, oy + e.y, e.rot);
    if (!res.ok) continue; // 미리 확인했으므로 일어나지 않는다
    const st = res.station;
    if (e.item) setSupplyItem(rules, st, e.item, world);
    if (e.filter) setStorageFilter(rules, st, e.filter);
    if (e.gate) setGateManual(st, e.gate.item, e.gate.count, e.gate.repeat);
  }
  noteTutorial(world, 'ui', 'blueprint');
  world.events.push({ type: 'blueprint', x: ox, y: oy, count: bp.entries.length });
  return check;
}

/**
 * 저장된 청사진을 믿지 않고 확인한다. 이상하면 null.
 * 이름은 화면에 textContent 로만 넣는다.
 */
export function validateBlueprint(rules, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, BLUEPRINT_NAME_MAX) : '';
  const { w, h } = raw;
  const sizeOk = (v) => Number.isInteger(v) && v >= 1 && v <= BLUEPRINT_MAX_SIZE;
  if (!name || !sizeOk(w) || !sizeOk(h)) return null;
  if (!Array.isArray(raw.entries) || raw.entries.length === 0 || raw.entries.length > BLUEPRINT_MAX_ENTRIES) return null;
  const isItem = (v) => typeof v === 'string' && Object.hasOwn(rules.items, v);
  const used = new Set();
  const entries = [];
  for (const e of raw.entries) {
    if (!e || typeof e !== 'object') return null;
    if (typeof e.type !== 'string' || !Object.hasOwn(rules.machines, e.type) || !rules.machines[e.type].cost) return null;
    if (![0, 1, 2, 3].includes(e.rot) || !Number.isInteger(e.x) || !Number.isInteger(e.y)) return null;
    const [ew, eh] = rotatedSize(rules.machines[e.type], e.rot);
    if (e.x < 0 || e.y < 0 || e.x + ew > w || e.y + eh > h) return null;
    for (let y = e.y; y < e.y + eh; y++) {
      for (let x = e.x; x < e.x + ew; x++) {
        if (used.has(y * BLUEPRINT_MAX_SIZE + x)) return null; // 겹침
        used.add(y * BLUEPRINT_MAX_SIZE + x);
      }
    }
    const clean = { type: e.type, x: e.x, y: e.y, rot: e.rot };
    if (isItem(e.item)) clean.item = e.item;
    if (isItem(e.filter)) clean.filter = e.filter;
    if (e.gate && isItem(e.gate.item) && Number.isInteger(e.gate.count)) {
      clean.gate = { item: e.gate.item, count: Math.max(1, Math.min(999, e.gate.count)), repeat: e.gate.repeat === true };
    }
    entries.push(clean);
  }
  return { name, w, h, entries };
}
