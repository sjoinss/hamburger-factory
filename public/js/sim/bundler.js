// 합류 포장기: 번호표(주문 번호)가 붙은 물건을 주문별로 모았다가, 주문이 다 모이면 한 묶음으로 앞 칸에 내보낸다.
// 번호표가 없거나 이미 끝난 주문의 물건은 그대로 통과시킨다 (출고구 바로 앞에 끼워 넣어도 되게).
import { stationAt, DIRS } from './lookup.js';
import { canInsertAt, insertSorted, makeBeltItem } from './conveyor.js';
import { counterAccepts, receiveAtCounter, orderById, orderNeeds } from './orders.js';

/** 통과시킬 물건은 이만큼만 줄 세운다 (넘치면 벨트가 밀린다) */
const PASS_QUEUE = 4;

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);
export const packedCount = (st) => Object.values(st.packs).reduce((a, p) => a + sum(p), 0);

function openOrder(world, tag) {
  if (tag === null || tag === undefined) return null;
  const o = orderById(world, tag);
  return o && o.state === 'open' ? o : null;
}

/** 이 주문에 아직 모자란 수 (이미 모은 것 빼고) */
const stillNeeds = (st, order, item) => orderNeeds(order, item) - (st.packs[order.id]?.[item] ?? 0);

export function bundlerAccepts(world, rules, st, item, tag) {
  const order = openOrder(world, tag);
  if (order && stillNeeds(st, order, item) > 0) return packedCount(st) < rules.machines[st.type].capacity;
  return st.out.length < PASS_QUEUE;
}

export function bundlerReceive(world, rules, st, item, tag, bag = null) {
  const order = openOrder(world, tag);
  if (!order || stillNeeds(st, order, item) <= 0) {
    st.out.push({ item, tag: tag ?? null, bag });
    return;
  }
  const pack = (st.packs[order.id] ??= {});
  pack[item] = (pack[item] ?? 0) + 1;
  if (Object.keys(order.items).every((id) => stillNeeds(st, order, id) <= 0)) {
    delete st.packs[order.id];
    st.out.push({ item: 'order_bag', tag: order.id, bag: pack });
    world.events.push({ type: 'bundled', orderId: order.id, x: st.x, y: st.y });
  }
}

/** 철거할 때 손으로 돌려받을 물건 (묶음은 풀어서) */
export function bundlerItems(st) {
  const list = [];
  const add = (obj) => { for (const [id, n] of Object.entries(obj)) for (let i = 0; i < n; i++) list.push(id); };
  for (const p of Object.values(st.packs)) add(p);
  for (const e of st.out) {
    if (e.bag) add(e.bag);
    else list.push(e.item);
  }
  return list;
}

function pushFront(world, rules, st, entry) {
  const [dx, dy] = DIRS[st.rot];
  const front = stationAt(world, st.x + dx, st.y + dy);
  if (!front) return false;
  const kind = rules.machines[front.type].kind;
  if (kind === 'belt') {
    const pos = front.rot === st.rot ? 0 : 0.5;
    if (!canInsertAt(front.items, pos)) return false;
    const from = { x: st.x + 0.5, y: st.y + 0.5 };
    insertSorted(front.items, { ...makeBeltItem(front, entry.item, pos, from), tag: entry.tag, bag: entry.bag });
    return true;
  }
  if (kind === 'counter') {
    if (!counterAccepts(world, rules, entry.item)) return false;
    receiveAtCounter(world, rules, entry.item, front, entry.tag, entry.bag);
    return true;
  }
  return false;
}

export function updateBundler(world, rules, st, dt) {
  // 끝난(시간 초과 등) 주문을 모으던 물건은 번호표 없이 내보낸다
  for (const id of Object.keys(st.packs)) {
    if (openOrder(world, Number(id))) continue;
    for (const [item, n] of Object.entries(st.packs[id])) {
      for (let i = 0; i < n; i++) st.out.push({ item, tag: null, bag: null });
    }
    delete st.packs[id];
  }
  const m = rules.machines[st.type];
  st.t = Math.max(0, st.t - dt);
  if (st.out.length === 0) {
    st.status = 'idle';
    return;
  }
  if (st.t > 0) {
    st.status = 'running';
    st.active = true;
    return;
  }
  if (!pushFront(world, rules, st, st.out[0])) {
    st.status = 'blocked';
    return;
  }
  const sent = st.out.shift();
  // 묶음은 포장하는 시간, 그냥 지나가는 물건은 잠깐
  st.t = sent.bag ? m.seconds : m.passSeconds;
  st.status = 'running';
  st.active = true;
}
