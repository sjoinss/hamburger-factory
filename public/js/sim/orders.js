// 주문서: 손님이 와서 주문하고, 출고구에 들어온 물건이 주문을 채운다. 남는 물건은 시세로 판다.
import { random, randomRange, pick, pickWeighted, randomInt } from './rng.js';
import { marketPrice, producible } from './market.js';
import { sellItem } from './economy.js';
import { record, recordEarned } from './stats.js';
import { noteTutorial } from './tutorial.js';

export function createOrders() {
  return { list: [], nextId: 1, timer: null };
}

export const openOrders = (world) => world.orders.list.filter((o) => o.state === 'open');
export const orderById = (world, id) => world.orders.list.find((o) => o.id === id) ?? null;

export function orderNeeds(order, item) {
  return Math.max(0, (order.items[item] ?? 0) - (order.delivered[item] ?? 0));
}
const orderComplete = (order) => Object.keys(order.items).every((id) => orderNeeds(order, id) === 0);

/** 이 물건을 기다리는 열린 주문이 있는가 */
export function anyOrderNeeds(world, item) {
  return world.features.includes('orders') && openOrders(world).some((o) => orderNeeds(o, item) > 0);
}

function spawnOrder(world, rules) {
  const cfg = rules.orders;
  // 지금 만들 수 있는 품목으로만 된 주문만 (새 메뉴가 열리면 섞여 나온다)
  const can = producible(world, rules);
  const doable = (t) => Object.keys(t).every((id) => can.has(id));
  const weights = Object.fromEntries(Object.entries(cfg.kinds)
    .filter(([, v]) => v.templates.some(doable))
    .map(([k, v]) => [k, v.weight]));
  if (Object.keys(weights).length === 0) return;
  const kindId = pickWeighted(world, weights);
  const kind = cfg.kinds[kindId];
  const items = { ...pick(world, kind.templates.filter(doable)) };
  const base = Object.entries(items).reduce((a, [id, n]) => a + marketPrice(world, rules, id) * n, 0);
  const order = {
    id: world.orders.nextId++,
    kind: kindId,
    items,
    delivered: {},
    reward: Math.round(base * randomRange(world, kind.rewardMul[0], kind.rewardMul[1])),
    createdAt: world.time,
    deadline: kind.deadline === null ? null : world.time + kind.deadline,
    state: 'open', // open | done | failed
    leaveAt: null,
    // 손님 생김새 (렌더용 색 번호)
    look: { hair: randomInt(world, 4), shirt: randomInt(world, 5), seed: Math.floor(random(world) * 1e6) },
  };
  world.orders.list.push(order);
  world.events.push({ type: 'orderNew', orderId: order.id });
}

function finish(world, rules, order, done) {
  const kind = rules.orders.kinds[order.kind];
  order.state = done ? 'done' : 'failed';
  order.leaveAt = world.time + rules.orders.leaveSeconds;
  world.reputation += done ? kind.repDone : kind.repFail;
  if (done) {
    world.money += order.reward;
    world.stats.earned += order.reward;
    recordEarned(world, order.reward);
    noteTutorial(world, 'order', 'any');
    noteTutorial(world, 'order', order.kind);
  }
  world.events.push({ type: done ? 'orderDone' : 'orderFailed', orderId: order.id, reward: done ? order.reward : 0 });
}

export function updateOrders(world, rules, dt) {
  if (!world.features.includes('orders')) return;
  const cfg = rules.orders;
  const o = world.orders;
  if (o.timer === null) o.timer = cfg.firstSpawnSeconds;
  o.timer -= dt;
  if (o.timer <= 0) {
    if (openOrders(world).length < cfg.maxOpen) spawnOrder(world, rules);
    o.timer = cfg.spawnSeconds;
  }
  for (const order of openOrders(world)) {
    if (order.deadline !== null && world.time >= order.deadline) finish(world, rules, order, false);
  }
  o.list = o.list.filter((x) => x.state === 'open' || world.time < x.leaveAt);
}

/** 출고구가 받을 수 있는가: 시세가 있는 물건이거나 주문이 기다리는 물건 */
export function counterAccepts(world, rules, item) {
  return rules.items[item].price > 0 || anyOrderNeeds(world, item);
}

/**
 * 출고구에 물건 하나가 들어왔다.
 * tag(주문 번호)가 붙어 있으면 그 주문 먼저, 아니면 가장 오래된 주문, 그래도 없으면 시세로 판매.
 */
export function receiveAtCounter(world, rules, item, station, tag = null) {
  let order = null;
  if (world.features.includes('orders')) {
    const open = openOrders(world);
    if (tag !== null) order = open.find((x) => x.id === tag && orderNeeds(x, item) > 0) ?? null;
    order ??= open.find((x) => orderNeeds(x, item) > 0) ?? null;
  }
  if (!order) {
    sellItem(world, rules, item, station, marketPrice(world, rules, item));
    noteTutorial(world, 'sold', item);
    return;
  }
  order.delivered[item] = (order.delivered[item] ?? 0) + 1;
  world.stats.sold[item] = (world.stats.sold[item] ?? 0) + 1;
  record(world, 'sold', item);
  noteTutorial(world, 'sold', item);
  world.events.push({ type: 'delivered', orderId: order.id, item });
  if (orderComplete(order)) finish(world, rules, order, true);
}
