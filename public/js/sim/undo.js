// 되돌리기: 건설·철거·청사진 붙여넣기를 거꾸로 한다. 기록은 저장하지 않는다 (이번 판에서만).
// 지은 것 되돌리기 = 철거 (부품 100% 환급), 철거 되돌리기 = 같은 자리에 다시 짓고 설정·등급을 돌려놓는다.
// 끌어서 깐 벨트 한 줄, 청사진 한 번은 한 번에 되돌린다.
import { placeMachine, removeMachine } from './build.js';
import { stationById } from './lookup.js';
import { readSettings, applySettings } from './presets.js';
import { missingCost, spendParts } from './parts.js';
import { levelOf } from './upgrade.js';

export const UNDO_MAX = 30;

export function createUndo() {
  return { stack: [] };
}

function push(undo, entry) {
  undo.stack.push(entry);
  if (undo.stack.length > UNDO_MAX) undo.stack.shift();
  return entry;
}

/**
 * 지은 기계들 기록. into 를 주면 그 기록에 이어 붙인다 (끌어서 깔기).
 * @param results placeMachine 결과들 (벨트를 바꿔 깐 경우 swapped 포함)
 */
export function noteBuilt(undo, results, into = null) {
  const items = results.map((r) => ({ id: r.station.id, type: r.station.type, swapped: r.swapped ?? null }));
  if (into && undo.stack.includes(into)) {
    into.items.push(...items);
    return into;
  }
  return push(undo, { kind: 'built', items });
}

/** 철거하기 직전에 부른다: 다시 지을 때 필요한 것 */
export function snapshotStation(rules, st) {
  return { id: st.id, type: st.type, x: st.x, y: st.y, rot: st.rot, level: levelOf(st), settings: readSettings(rules, st) };
}

export function noteRemoved(undo, snap) {
  return push(undo, { kind: 'removed', snap });
}

/** 기록 속 기계 번호를 바꾼다 (철거를 되돌리면 새 번호로 지어지므로) */
function renumber(undo, from, to) {
  for (const e of undo.stack) {
    if (e.kind === 'built') for (const it of e.items) if (it.id === from) it.id = to;
    if (e.kind === 'removed' && e.snap.id === from) e.snap.id = to;
  }
}

/**
 * 마지막 기록을 되돌린다.
 * @returns {{ ok, reason?, kind?, count? }} reason: empty | items(손이 모자람) | blocked | parts
 */
export function undoLast(world, rules, undo) {
  const entry = undo.stack.at(-1);
  if (!entry) return { ok: false, reason: 'empty' };

  if (entry.kind === 'built') {
    const left = [];
    let count = 0;
    let reason = null;
    for (const it of [...entry.items].reverse()) {
      const st = stationById(world, it.id);
      if (!st || st.type !== it.type) continue; // 그 사이 철거·교체됨
      const res = it.swapped
        ? placeMachine(world, rules, it.swapped.type, st.x, st.y, it.swapped.rot)
        : removeMachine(world, rules, st.x, st.y);
      if (res.ok) count++;
      else {
        reason ??= res.reason;
        left.unshift(it);
      }
    }
    if (left.length) {
      entry.items = left;
      return { ok: false, reason: ['items', 'parts'].includes(reason) ? reason : 'blocked', kind: 'built', count };
    }
    undo.stack.pop();
    // 이미 다 철거된 기록이면 그 앞 기록으로
    return count ? { ok: true, kind: 'built', count } : undoLast(world, rules, undo);
  }

  const s = entry.snap;
  const res = placeMachine(world, rules, s.type, s.x, s.y, s.rot);
  if (!res.ok) {
    // 부품이 모자라면 기다릴 수 있지만, 자리가 막혔으면 이 기록은 버린다 (다음 되돌리기가 막히지 않게)
    if (res.reason !== 'parts') undo.stack.pop();
    return { ok: false, reason: res.reason === 'parts' ? 'parts' : 'blocked', kind: 'removed' };
  }
  undo.stack.pop();
  const st = res.station;
  if (s.settings) applySettings(world, rules, st, s.settings);
  // 등급: 철거할 때 돌려받은 업그레이드 부품을 다시 내고 되살린다 (돈은 철거 때 돌려받지 않았으므로 그대로)
  for (const cost of rules.game.upgrades.costs.slice(0, s.level)) {
    if (Object.keys(missingCost(world, rules, cost.parts)).length) break;
    spendParts(world, rules, cost.parts);
    st.level = levelOf(st) + 1;
  }
  renumber(undo, s.id, st.id);
  return { ok: true, kind: 'removed', count: 1 };
}
