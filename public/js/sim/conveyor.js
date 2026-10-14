// 컨베이어 시뮬레이션. 벨트 위 물건은 칸 안의 실제 위치(0~1)를 가진다.
// 앞이 막히면 뒤 물건이 간격을 두고 멈추고, 그 막힘이 위쪽 벨트로 자연스럽게 번진다.
import { stationAt, DIRS } from './lookup.js';
import { canStore, store } from './storage.js';
import { counterAccepts, receiveAtCounter } from './orders.js';
import { noteTutorial } from './tutorial.js';
import { bundlerAccepts, bundlerReceive } from './bundler.js';

/** 벨트가 끝에서 바로 넣을 수 있는 기계 (투입기 없이) */
const SINK_KINDS = new Set(['storage', 'counter', 'generator', 'bundler']);

/** 물건 사이 최소 간격 (칸 단위). 1/3 보다 살짝 커서 한 칸에 최대 3개 */
export const SPACING = 0.34;
const EPS = 1e-6;

export const isConveyorKind = (kind) => kind === 'belt' || kind === 'splitter' || kind === 'merger';
const kindOf = (rules, st) => rules.machines[st.type].kind;

/** item 이 dir 방향으로 움직이며 node 로 들어올 수 있는가 */
function acceptsFrom(rules, node, dir) {
  const kind = kindOf(rules, node);
  if (kind === 'splitter') return dir === node.rot;
  return dir !== (node.rot + 2) % 4; // 벨트/합류기: 정면으로 거슬러 들어오는 것만 안 됨
}

/** 들어올 때 위치: 뒤에서 이어지면 0, 옆에서 끼어들면 가운데 */
const entryPos = (node, dir) => (dir === node.rot ? 0 : 0.5);

export function canInsertAt(items, pos) {
  return pos >= -EPS && pos <= 1 + EPS && items.every((it) => Math.abs(it.pos - pos) >= SPACING - EPS);
}

/** 앞쪽(pos 큰 것)이 먼저 오게 끼워 넣는다 */
export function insertSorted(items, entry) {
  let i = 0;
  while (i < items.length && items[i].pos > entry.pos) i++;
  items.splice(i, 0, entry);
}

/** 벨트 위 위치 → 월드 좌표 (칸 단위, 중심 기준) */
export function beltPoint(node, pos) {
  const [dx, dy] = DIRS[node.rot];
  return { x: node.x + 0.5 + dx * (pos - 0.5), y: node.y + 0.5 + dy * (pos - 0.5) };
}

export function makeBeltItem(node, item, pos, from = null) {
  const p = beltPoint(node, pos);
  return { item, pos, x: p.x, y: p.y, px: from?.x ?? p.x, py: from?.y ?? p.y, tag: null, bag: null };
}

function neighbor(world, rules, node, dir) {
  const [dx, dy] = DIRS[dir];
  const st = stationAt(world, node.x + dx, node.y + dy);
  if (!st || !isConveyorKind(kindOf(rules, st)) || !acceptsFrom(rules, st, dir)) return null;
  return st;
}

// ── 연결 정보: 기계 배치가 바뀔 때만 다시 계산 ──
const netCache = new WeakMap();

export function conveyorNetwork(world, rules) {
  const cached = netCache.get(world);
  if (cached && cached.version === world.stationsVersion && cached.stations === world.stations) return cached;

  const nodes = world.stations.filter((s) => isConveyorKind(kindOf(rules, s)));
  const next = new Map(); // 벨트 → 다음 칸
  const sink = new Map(); // 벨트 → 끝에서 바로 넣는 저장소/출고구
  const outputs = new Map(); // 분배기/합류기 → [{ dir, node }]
  const upstream = new Map(); // 분배기/합류기 → 이 칸으로 들어오는 벨트들

  for (const n of nodes) {
    const kind = kindOf(rules, n);
    if (kind === 'belt') {
      next.set(n.id, neighbor(world, rules, n, n.rot));
      const [dx, dy] = DIRS[n.rot];
      const front = stationAt(world, n.x + dx, n.y + dy);
      if (front && SINK_KINDS.has(kindOf(rules, front))) sink.set(n.id, front);
    } else {
      const dirs = kind === 'splitter' ? [(n.rot + 3) % 4, (n.rot + 1) % 4] : [n.rot];
      outputs.set(n.id, dirs.map((dir) => ({ dir, node: neighbor(world, rules, n, dir) })));
      upstream.set(n.id, []);
    }
  }
  for (const n of nodes) {
    const nx = next.get(n.id);
    if (nx && upstream.has(nx.id)) upstream.get(nx.id).push(n);
  }
  for (const list of upstream.values()) list.sort((a, b) => a.id - b.id);

  // 아래쪽(물건이 흘러가는 쪽)부터 처리해야 같은 틱에 빈자리가 바로 반영된다.
  const order = [];
  const visited = new Set();
  const edges = (n) => (next.has(n.id) ? [next.get(n.id)] : (outputs.get(n.id) ?? []).map((o) => o.node)).filter(Boolean);
  for (const start of nodes) {
    if (visited.has(start.id)) continue;
    const stack = [[start, false]];
    while (stack.length) {
      const [n, done] = stack.pop();
      if (done) { order.push(n); continue; }
      if (visited.has(n.id)) continue;
      visited.add(n.id);
      stack.push([n, true]);
      for (const m of edges(n)) if (!visited.has(m.id)) stack.push([m, false]);
    }
  }

  const net = { version: world.stationsVersion, stations: world.stations, order, next, outputs, upstream, sink };
  netCache.set(world, net);
  return net;
}

/** 벨트 끝 물건을 저장소/출고구에 넣는다. 못 넣으면 false (끝에서 대기) */
function deliverToSink(world, rules, st, it) {
  if (kindOf(rules, st) === 'generator') {
    const m = rules.machines[st.type];
    if (it.item !== m.fuel || st.contents.length >= m.fuelCap) return false;
    st.contents.push(it.item);
    noteTutorial(world, 'fed', st.type);
    return true;
  }
  if (kindOf(rules, st) === 'storage') {
    if (!canStore(rules, st, it.item)) return false;
    store(st, it.item);
    noteTutorial(world, 'fed', st.type);
    return true;
  }
  if (kindOf(rules, st) === 'bundler') {
    if (!bundlerAccepts(world, rules, st, it.item, it.tag ?? null)) return false;
    bundlerReceive(world, rules, st, it.item, it.tag ?? null, it.bag ?? null);
    return true;
  }
  if (!counterAccepts(world, rules, it.item)) return false;
  receiveAtCounter(world, rules, it.item, st, it.tag ?? null, it.bag ?? null);
  return true;
}

function moveBelt(world, rules, belt, net, dt) {
  const v = rules.machines[belt.type].speed * dt;
  const next = net.next.get(belt.id);
  const nextIsBelt = next && kindOf(rules, next) === 'belt';
  const sinkSt = net.sink.get(belt.id);
  const keep = [];
  let ahead = Infinity;
  for (const it of belt.items) {
    let target = Math.max(it.pos, Math.min(it.pos + v, ahead - SPACING));
    if (target > 1) {
      if (nextIsBelt) {
        const entry = entryPos(next, belt.rot);
        const pos = entry === 0 ? target - 1 : entry;
        if (canInsertAt(next.items, pos)) {
          insertSorted(next.items, { ...it, pos });
          continue;
        }
      }
      if (sinkSt && keep.length === 0 && deliverToSink(world, rules, sinkSt, it)) continue;
      target = 1; // 끝에서 대기 (다음 칸이 없거나 꽉 참)
    }
    it.pos = target;
    keep.push(it);
    ahead = it.pos;
  }
  belt.items = keep;
  belt.active = keep.length > 0;
  // 병목 보기용: 꽉 차서 멈춤(3개 + 맨 앞이 끝에서 대기) / 비어 있음 을 2초 정도로 부드럽게
  const k = Math.min(1, dt / 2);
  const jammed = keep.length >= 3 && keep[0].pos >= 1 - EPS;
  belt.jam += ((jammed ? 1 : 0) - belt.jam) * k;
  belt.idle += ((keep.length === 0 ? 1 : 0) - belt.idle) * k;
}

/**
 * 분배기·합류기: 한 번에 하나를 담아 넘긴다. 물건이 머무는 시간은 꽉 찬 벨트에서 물건 하나가 지나가는 시간
 * (간격 SPACING 만큼)이라서, 들어온 벨트만큼 흘려보낸다 (고속 벨트에서 온 물건은 고속으로).
 */
function updateRouter(rules, router, net, dt) {
  const kind = kindOf(rules, router);
  const speed = Math.max(rules.machines[router.type].speed, router.buffer?.speed ?? 0);
  const v = (speed / SPACING) * dt;

  if (router.buffer) {
    router.buffer.pos = Math.min(1, router.buffer.pos + v);
    if (router.buffer.pos >= 1 - EPS) {
      const outs = net.outputs.get(router.id);
      const order = kind === 'splitter' ? [outs[router.toggle], outs[1 - router.toggle]] : outs;
      for (const o of order) {
        if (!o?.node) continue;
        const pos = entryPos(o.node, o.dir);
        if (o.node.items && canInsertAt(o.node.items, pos)) {
          const { speed: _, ...item } = router.buffer;
          insertSorted(o.node.items, { ...item, pos });
          if (kind === 'splitter') router.toggle = outs.indexOf(o) === 0 ? 1 : 0; // 다음엔 반대쪽 먼저
          router.buffer = null;
          break;
        }
      }
    }
  }

  if (!router.buffer) {
    // 들어오는 벨트들을 돌아가며 확인 (합류기는 공평하게 하나씩)
    const ups = net.upstream.get(router.id);
    for (let k = 0; k < ups.length; k++) {
      const u = ups[(router.rr + k) % ups.length];
      const lead = u.items[0];
      if (lead && lead.pos >= 1 - EPS) {
        u.items.shift();
        router.buffer = { ...lead, pos: 0, speed: rules.machines[u.type].speed };
        router.rr = (router.rr + k + 1) % ups.length;
        break;
      }
    }
  }
  router.active = router.buffer !== null;
}

export function updateConveyors(world, rules, dt) {
  dt *= world.power?.ratio ?? 1;
  const net = conveyorNetwork(world, rules);
  for (const n of net.order) {
    for (const it of n.items ?? []) { it.px = it.x; it.py = it.y; }
    if (n.buffer) { n.buffer.px = n.buffer.x; n.buffer.py = n.buffer.y; }
  }
  for (const n of net.order) {
    if (kindOf(rules, n) === 'belt') moveBelt(world, rules, n, net, dt);
    else updateRouter(rules, n, net, dt);
  }
  for (const n of net.order) {
    for (const it of n.items ?? []) Object.assign(it, beltPoint(n, it.pos));
    if (n.buffer) Object.assign(n.buffer, beltPoint(n, n.buffer.pos));
  }
}
