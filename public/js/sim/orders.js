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
    auto: false, // 주문 인식기가 맡겼는가
  };
  world.orders.list.push(order);
  world.events.push({ type: 'orderNew', orderId: order.id });
}

/** bundled: 합류 포장기가 한 묶음으로 납품 (보상에 묶음 보너스) */
function finish(world, rules, order, done, bundled = false) {
  const kind = rules.orders.kinds[order.kind];
  order.state = done ? 'done' : 'failed';
  order.leaveAt = world.time + rules.orders.leaveSeconds;
  world.reputation += done ? kind.repDone : kind.repFail;
  const reward = done ? Math.round(order.reward * (bundled ? rules.orders.bundleBonus : 1)) : 0;
  const tally = world.stats.orders;
  tally[done ? 'done' : 'failed'] += 1;
  if (done && order.auto) tally.auto += 1;
  if (done && bundled) tally.bundled += 1;
  if (done) {
    world.money += reward;
    world.stats.earned += reward;
    recordEarned(world, reward);
    noteTutorial(world, 'order', 'any');
    noteTutorial(world, 'order', order.kind);
    if (order.auto) noteTutorial(world, 'order', 'auto');
    if (bundled) noteTutorial(world, 'order', 'bundle');
  }
  world.events.push({ type: done ? 'orderDone' : 'orderFailed', orderId: order.id, reward, bundled });
}

/** 손님이 오는 간격: 평판이 오를수록 짧아진다 (주문을 잘 처리하면 장사가 잘된다) */
export function spawnInterval(world, rules) {
  const cfg = rules.orders;
  return Math.max(cfg.minSpawnSeconds, cfg.spawnSeconds - Math.max(0, world.reputation) * cfg.repSpawnStep);
}

/**
 * @param customers false 면 손님이 멈춘다: 새 손님이 오지 않고, 와 있는 주문의 남은 시간도 줄지 않는다
 *   (자리 비운 동안 빨리 돌릴 때. 공장은 그대로 돌아서 와 있는 주문은 채울 수 있다)
 */
export function updateOrders(world, rules, dt, customers = true) {
  if (!world.features.includes('orders')) return;
  const cfg = rules.orders;
  const o = world.orders;
  if (!customers) {
    for (const order of openOrders(world)) if (order.deadline !== null) order.deadline += dt;
    o.list = o.list.filter((x) => x.state === 'open' || world.time < x.leaveAt);
    return;
  }
  if (o.timer === null) o.timer = cfg.firstSpawnSeconds;
  o.timer -= dt;
  if (o.timer <= 0) {
    if (openOrders(world).length < cfg.maxOpen) spawnOrder(world, rules);
    o.timer = spawnInterval(world, rules);
  }
  for (const order of openOrders(world)) {
    if (order.deadline !== null && world.time >= order.deadline) finish(world, rules, order, false);
  }
  o.list = o.list.filter((x) => x.state === 'open' || world.time < x.leaveAt);
}

/** 출고구가 받을 수 있는가: 시세가 있는 물건이거나 주문이 기다리는 물건 */
export function counterAccepts(world, rules, item) {
  return rules.items[item].price > 0 || rules.items[item].category === 'bundle' || anyOrderNeeds(world, item);
}

/** 주문 묶음: 그 주문을 한 번에 채운다. 그 사이 주문이 끝났으면 안에 든 물건을 시세로 판다. */
function receiveBag(world, rules, station, tag, bag) {
  const order = tag === null ? null : orderById(world, tag);
  const left = { ...(bag ?? {}) };
  if (order && order.state === 'open') {
    for (const [id, n] of Object.entries(order.items)) {
      const add = orderNeeds(order, id);
      if (add === 0) continue;
      order.delivered[id] = n;
      left[id] = Math.max(0, (left[id] ?? 0) - add);
      world.stats.sold[id] = (world.stats.sold[id] ?? 0) + add;
      record(world, 'sold', id, add);
    }
    world.events.push({ type: 'delivered', orderId: order.id, item: 'order_bag' });
    finish(world, rules, order, true, true);
  }
  // 남는 물건 (주문이 이미 끝났거나 다른 길로 먼저 채워진 몫)은 시세로
  for (const [id, n] of Object.entries(left)) {
    if (!Object.hasOwn(rules.items, id)) continue;
    for (let i = 0; i < n; i++) sellItem(world, rules, id, station, marketPrice(world, rules, id));
  }
}

/**
 * 출고구에 물건 하나가 들어왔다.
 * tag(주문 번호)가 붙어 있으면 그 주문 먼저, 아니면 가장 오래된 주문, 그래도 없으면 시세로 판매.
 */
export function receiveAtCounter(world, rules, item, station, tag = null, bag = null) {
  if (rules.items[item].category === 'bundle') {
    receiveBag(world, rules, station, tag, bag);
    return;
  }
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
