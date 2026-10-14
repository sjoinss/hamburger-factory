// 주문 인식기: 주문서를 읽어서, 붙어 있는 출고 게이트 중 놀고 있는 게이트에 주문을 맡긴다.
// 게이트의 호퍼/사일로에 그 주문을 다 채울 재고가 있을 때만 맡긴다 (반쯤 보내고 멈추지 않게).
// 남은 시간이 짧은 주문부터, 그다음 먼저 온 순서.
import { stationAt, DIRS } from './lookup.js';
import { gateSources, setGateOrder } from './gate.js';
import { openOrders, orderById, orderNeeds } from './orders.js';

/** 인식기 둘레에 붙은 출고 게이트들 */
export function readerGates(world, rules, rd) {
  const found = new Map();
  for (let y = rd.y; y < rd.y + rd.h; y++) {
    for (let x = rd.x; x < rd.x + rd.w; x++) {
      for (const [dx, dy] of DIRS) {
        const st = stationAt(world, x + dx, y + dy);
        if (st && st !== rd && rules.machines[st.type].kind === 'gate') found.set(st.id, st);
      }
    }
  }
  return [...found.values()].sort((a, b) => a.id - b.id);
}

/** 게이트가 새 주문을 받을 수 있는가: 품목을 안 정한 수동 모드, 또는 맡은 주문이 끝났거나 다 보냄 */
function gateFree(world, gate) {
  const m = gate.mode;
  if (m.kind === 'manual') return m.item === null;
  const order = orderById(world, m.orderId);
  if (!order || order.state !== 'open') return true;
  return Object.keys(order.items).every((id) => (m.orderSent[id] ?? 0) >= order.items[id]);
}

/** 이 게이트의 저장소들로 주문의 남은 품목을 다 채울 수 있는가 */
function coverable(world, rules, gate, order) {
  const sources = gateSources(world, rules, gate);
  return Object.keys(order.items).every((id) => {
    const need = orderNeeds(order, id);
    if (need === 0) return true;
    return sources.reduce((a, s) => a + (s.stock[id] ?? 0), 0) >= need;
  });
}

const urgency = (o) => (o.deadline === null ? Infinity : o.deadline);

export function updateReader(world, rules, rd, dt) {
  rd.t = Math.max(0, rd.t - dt);
  if (rd.t > 0) return;
  rd.t = rules.machines[rd.type].seconds;

  const gates = readerGates(world, rules, rd);
  const busyAuto = gates.some((g) => g.mode.kind === 'order' && g.mode.auto && !gateFree(world, g));
  if (gates.length === 0) {
    rd.status = 'idle';
    rd.reason = 'no-gate';
    return;
  }
  // 이미 어느 게이트든 맡고 있는 주문은 빼고
  const taken = new Set(world.stations
    .filter((s) => rules.machines[s.type].kind === 'gate' && s.mode.kind === 'order' && !gateFree(world, s))
    .map((s) => s.mode.orderId));
  const waiting = openOrders(world)
    .filter((o) => !taken.has(o.id))
    .sort((a, b) => urgency(a) - urgency(b) || a.id - b.id);

  let assigned = false;
  for (const gate of gates) {
    if (!gateFree(world, gate)) continue;
    const order = waiting.find((o) => !taken.has(o.id) && coverable(world, rules, gate, o));
    if (!order) continue;
    setGateOrder(gate, order.id);
    gate.mode.auto = true;
    order.auto = true;
    taken.add(order.id);
    rd.last = order.id;
    assigned = true;
  }
  if (assigned) {
    rd.status = 'running';
    rd.reason = 'assigned';
    rd.active = true;
    world.events.push({ type: 'readerAssigned', orderId: rd.last, x: rd.x, y: rd.y });
  } else if (busyAuto) {
    rd.status = 'running';
    rd.reason = 'busy';
  } else {
    rd.status = 'idle';
    rd.reason = waiting.length === 0 ? 'no-order' : 'no-stock';
  }
}
