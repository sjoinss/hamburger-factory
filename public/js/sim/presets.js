// 기계 설정 (입고 품목, 저장소 필터, 게이트 방식): 읽어 두었다가 다른 같은 종류 기계에 그대로 옮긴다.
// 설정 복사·붙이기, 철거 되돌리기, 청사진 붙여넣기가 함께 쓴다.
import { setSupplyItem } from './station.js';
import { setStorageFilter } from './storage.js';
import { setGateManual } from './gate.js';

const SETTING_KINDS = new Set(['supply', 'storage', 'gate']);

/** 설정이 있는 기계 종류인가 (supply | storage | gate, 아니면 null) */
export function settingsKind(rules, type) {
  const kind = rules.machines[type].kind;
  return SETTING_KINDS.has(kind) ? kind : null;
}

/** { item? | filter? | gate? | gateOrder? } (설정이 없는 기계면 null) */
export function readSettings(rules, st) {
  const kind = settingsKind(rules, st.type);
  if (kind === 'supply') return { item: st.item };
  if (kind === 'storage') return { filter: st.filter ?? null };
  if (kind === 'gate') {
    if (st.mode.kind === 'order') return { gateOrder: true };
    return { gate: { item: st.mode.item, count: st.mode.count, repeat: st.mode.repeat } };
  }
  return null;
}

/** 설정을 적용한다. 종류가 맞지 않거나 쓸 수 없는 값(해금 전 입고 품목 등)이면 false */
export function applySettings(world, rules, st, s) {
  const kind = settingsKind(rules, st.type);
  if (!kind || !s) return false;
  if (kind === 'supply') return s.item !== undefined && setSupplyItem(rules, st, s.item, world);
  if (kind === 'storage') return s.filter !== undefined && setStorageFilter(rules, st, s.filter);
  if (s.gateOrder) {
    if (st.mode.kind !== 'order') st.mode = { ...st.mode, kind: 'order', orderId: null, orderSent: {} };
    return true;
  }
  if (!s.gate) return false;
  if (s.gate.item !== null && !Object.hasOwn(rules.items, s.gate.item)) return false;
  setGateManual(st, s.gate.item, s.gate.count, s.gate.repeat);
  return true;
}
