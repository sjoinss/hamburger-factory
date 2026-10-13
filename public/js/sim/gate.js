// 출고 게이트: 붙어 있는 호퍼/사일로에서 꺼내 앞 칸으로 내보낸다.
// 수동: 품목 N개 (반복 가능) / 주문: 맡은 주문의 남은 품목을 순서대로 (주문 번호표를 붙여 보낸다).
import { stationAt, DIRS } from './lookup.js';
import { canStore, store, takeFromStorage } from './storage.js';
import { canAccept, machineOf } from './station.js';
import { canInsertAt, insertSorted, makeBeltItem } from './conveyor.js';
import { counterAccepts, receiveAtCounter, orderById } from './orders.js';
import { noteTutorial } from './tutorial.js';
import { bundlerAccepts, bundlerReceive } from './bundler.js';

export function createGateMode() {
  // auto: 주문 인식기가 맡긴 주문
  return { kind: 'manual', item: null, count: 1, repeat: false, sent: 0, orderId: null, orderSent: {}, auto: false };
}

/**
 * 셔터 칸: 회전 전 기준 첫 칸(위 칸)이 회전한 자리. 스프라이트의 셔터와 같은 칸이다.
 * 0 위 칸, 1(아래로) 오른쪽 칸, 2(왼쪽으로) 아래 칸, 3(위로) 왼쪽 칸
 */
export function gateOutletCell(gate) {
  const x = gate.rot === 1 || gate.rot === 2 ? gate.x + gate.w - 1 : gate.x;
  const y = gate.rot === 2 || gate.rot === 3 ? gate.y + gate.h - 1 : gate.y;
  return { x, y };
}

/** 내보내는 칸: 셔터 칸의 앞 */
export function gateFront(gate) {
  const [dx, dy] = DIRS[gate.rot];
  const c = gateOutletCell(gate);
  return { x: c.x + dx, y: c.y + dy };
}

/** 게이트 칸에 붙어 있는 저장소들 (앞 칸 제외) */
export function gateSources(world, rules, gate) {
  const front = gateFront(gate);
  const found = new Map();
  for (let y = gate.y; y < gate.y + gate.h; y++) {
    for (let x = gate.x; x < gate.x + gate.w; x++) {
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx === front.x && ny === front.y) continue;
        const st = stationAt(world, nx, ny);
        if (st && st !== gate && rules.machines[st.type].kind === 'storage') found.set(st.id, st);
      }
    }
  }
  return [...found.values()];
}

/** 앞 칸에 item 을 넣는 함수 (못 넣으면 null) */
function outputFor(world, rules, gate, item, tag) {
  const front = gateFront(gate);
  const st = stationAt(world, front.x, front.y);
  if (!st) return null;
  const kind = machineOf(rules, st).kind;
  if (kind === 'belt') {
    const pos = st.rot === gate.rot ? 0 : 0.5;
    if (!canInsertAt(st.items, pos)) return null;
    const c = gateOutletCell(gate);
    const from = { x: c.x + 0.5, y: c.y + 0.5 };
    return () => insertSorted(st.items, { ...makeBeltItem(st, item, pos, from), tag });
  }
  if (kind === 'counter') {
    return counterAccepts(world, rules, item) ? () => receiveAtCounter(world, rules, item, st, tag) : null;
  }
  if (kind === 'storage') {
    if (!canStore(rules, st, item)) return null;
    return () => {
      store(st, item);
      noteTutorial(world, 'fed', st.type);
    };
  }
  if (kind === 'bundler') {
    return bundlerAccepts(world, rules, st, item, tag) ? () => bundlerReceive(world, rules, st, item, tag) : null;
  }
  if ((kind === 'machine' || kind === 'crafter') && canAccept(rules, st, item)) return () => st.contents.push(item);
  return null;
}

/** 이번에 보낼 품목 후보 (우선순위 순). 보낼 게 없으면 이유. */
function wanted(world, gate) {
  const m = gate.mode;
  if (m.kind === 'manual') {
    if (!m.item) return { items: [], reason: 'unset' };
    if (m.sent >= m.count) {
      if (!m.repeat) return { items: [], reason: 'done' };
      m.sent = 0;
    }
    return { items: [m.item], tag: null };
  }
  const order = orderById(world, m.orderId);
  if (!order || order.state !== 'open') return { items: [], reason: 'done' };
  const items = Object.keys(order.items).filter((id) => (m.orderSent[id] ?? 0) < order.items[id]);
  return items.length ? { items, tag: order.id } : { items: [], reason: 'done' };
}

export function updateGate(world, rules, gate, dt) {
  gate.t = Math.max(0, gate.t - dt);
  if (gate.t > 0) return;
  const w = wanted(world, gate);
  if (w.items.length === 0) {
    gate.status = 'idle';
    gate.reason = w.reason;
    return;
  }
  const sources = gateSources(world, rules, gate);
  let blocked = false;
  for (const item of w.items) {
    const src = sources.find((s) => (s.stock[item] ?? 0) > 0);
    if (!src) continue;
    const out = outputFor(world, rules, gate, item, w.tag);
    if (!out) {
      blocked = true;
      continue;
    }
    takeFromStorage(src, item);
    out();
    if (gate.mode.kind === 'manual') gate.mode.sent += 1;
    else gate.mode.orderSent[item] = (gate.mode.orderSent[item] ?? 0) + 1;
    gate.t = machineOf(rules, gate).seconds;
    gate.status = 'running';
    gate.reason = null;
    gate.active = true;
    return;
  }
  gate.status = blocked ? 'blocked' : 'idle';
  gate.reason = blocked ? 'blocked' : sources.length ? 'no-stock' : 'no-source';
}

export function setGateManual(gate, item, count, repeat) {
  gate.mode = { ...createGateMode(), item, count: Math.max(1, Math.min(999, Math.floor(count))), repeat: Boolean(repeat) };
}

export function setGateOrder(gate, orderId) {
  gate.mode = { ...createGateMode(), kind: 'order', orderId };
}
