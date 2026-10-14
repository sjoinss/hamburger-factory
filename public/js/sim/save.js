// 저장/불러오기. 저장 데이터는 믿지 않는다: 새 월드를 만든 뒤, 확인한 값만 하나씩 옮겨 담는다.
// 이상한 값은 버리거나 기본값으로 바꾸고, 형식 자체가 틀리면 Error (메시지는 화면에 그대로 보여 줄 수 있는 짧은 글).
import { createWorld } from './world.js';
import { createStation, rotatedSize } from './station.js';
import { TILE, getTile, getOccupant, inBounds, isSolid, setOccupant } from './grid.js';
import { openZone, zoneMult } from './zones.js';
import { canInsertAt, insertSorted, makeBeltItem } from './conveyor.js';
import { BUCKETS, HISTORY_SECONDS } from './stats.js';
import { FEATURES } from '../data.js';
import { upgradable } from './upgrade.js';

export const SAVE_FORMAT = 'hamburger-factory-save';
export const SAVE_VERSION = 1;
export const SAVE_MAX_CHARS = 5_000_000;

const LIMIT = { list: 64, orders: 30, ground: 200, packs: 20, log: 300 };

/**
 * 저장할 문자열. 격자와 캐시 번호는 구역·기계로 다시 만들 수 있으니 넣지 않는다.
 * savedAt: 저장한 시각 (ms, 자리 비운 시간 계산용. 시뮬레이션은 실제 시계를 모르므로 밖에서 준다)
 */
export function serializeWorld(world, savedAt = null) {
  const { events, grid, stationsVersion, ...rest } = world;
  return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, savedAt, world: rest });
}

// ── 값 확인 도구 ──
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v, min, max, def) => (fin(v) ? Math.min(max, Math.max(min, v)) : def);
const int = (v, min, max, def) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : def);
const bool = (v, def = false) => (typeof v === 'boolean' ? v : def);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const entries = (v) => (isObj(v) ? Object.entries(v) : []);

function makeChecks(rules) {
  const itemId = (v) => (typeof v === 'string' && Object.hasOwn(rules.items, v) ? v : null);
  const items = (v, max = LIMIT.list) => (Array.isArray(v) ? v.slice(0, max).map(itemId).filter(Boolean) : []);
  /** { key: 양의 정수 } (keyOk 를 통과한 키만) */
  const counts = (v, keyOk = itemId, max = 1e9) => {
    const out = {};
    for (const [k, n] of entries(v)) {
      if (!keyOk(k)) continue;
      const c = int(n, 0, max, 0);
      if (c > 0) out[k] = c;
    }
    return out;
  };
  const tag = (v) => (Number.isInteger(v) && v > 0 ? v : null);
  const bag = (v) => {
    const c = counts(v, itemId, 999);
    return Object.keys(c).length ? c : null;
  };
  return { itemId, items, counts, tag, bag };
}

/**
 * 저장 문자열 → 새 월드. 실패하면 Error.
 * @returns {{ world, dropped: number }} dropped: 자리가 맞지 않아 버린 기계 수
 */
export function loadWorld(rules, text) {
  if (typeof text !== 'string' || text.length === 0) throw new Error('저장 데이터가 비어 있다');
  if (text.length > SAVE_MAX_CHARS) throw new Error('저장 파일이 너무 크다');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('저장 파일을 읽을 수 없다 (JSON 아님)');
  }
  if (!isObj(data) || data.format !== SAVE_FORMAT) throw new Error('햄버거 공장 저장 파일이 아니다');
  if (!Number.isInteger(data.version) || data.version < 1 || data.version > SAVE_VERSION) {
    throw new Error('지원하지 않는 저장 버전');
  }
  if (!isObj(data.world)) throw new Error('저장 데이터가 망가졌다');
  return { ...restore(rules, data.world), savedAt: fin(data.savedAt) && data.savedAt > 0 ? data.savedAt : null };
}

function restore(rules, s) {
  const c = makeChecks(rules);
  const w = createWorld(rules);

  w.rng = int(s.rng, -(2 ** 31), 2 ** 31 - 1, w.rng);
  w.tick = int(s.tick, 0, Number.MAX_SAFE_INTEGER, 0);
  w.time = num(s.time, 0, 1e9, 0);
  w.money = num(s.money, -1e12, 1e12, 0);
  w.reputation = int(s.reputation, -1e6, 1e6, 0);

  // 해금 상태
  const recipeIds = new Set(rules.recipes.map((r) => r.id));
  const supplyIds = new Set(Object.values(rules.machines).filter((m) => m.kind === 'supply').flatMap((m) => m.supplies));
  const ids = (v, ok) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && ok(x)))] : []);
  const u = isObj(s.unlocked) ? s.unlocked : {};
  w.unlocked = {
    recipes: ids([...w.unlocked.recipes, ...(Array.isArray(u.recipes) ? u.recipes : [])], (x) => recipeIds.has(x)),
    machines: ids(u.machines, (x) => Object.hasOwn(rules.machines, x) && Boolean(rules.machines[x].cost)),
    supplies: ids([...w.unlocked.supplies, ...(Array.isArray(u.supplies) ? u.supplies : [])], (x) => supplyIds.has(x)),
  };
  const stageIds = new Set(rules.progression.stages.map((st) => st.id));
  w.stagesDone = ids(s.stagesDone, (x) => stageIds.has(x));
  w.features = ids(s.features, (x) => FEATURES.has(x));
  w.parts = c.counts(s.parts, (k) => c.itemId(k) !== null && rules.items[k].category === 'part', 1e7);

  // 구역: 앞 구역부터 순서대로
  for (const z of rules.zones.zones) {
    const bought = Array.isArray(s.zonesBought) && s.zonesBought.includes(z.id);
    if (bought && (!z.requires || w.zonesBought.includes(z.requires))) openZone(w, rules, z);
  }

  const dropped = restoreStations(rules, w, s.stations, c);
  restorePlayer(rules, w, s.player, c);
  w.groundItems = [];
  for (const g of Array.isArray(s.groundItems) ? s.groundItems.slice(0, LIMIT.ground) : []) {
    const item = c.itemId(g?.item);
    if (!item || !Number.isInteger(g.x) || !Number.isInteger(g.y)) continue;
    if (getTile(w.grid, g.x, g.y) !== TILE.FLOOR || getOccupant(w.grid, g.x, g.y) !== null) continue;
    if (w.groundItems.some((o) => o.x === g.x && o.y === g.y)) continue;
    w.groundItems.push({ x: g.x, y: g.y, item });
  }

  restoreStats(rules, w, s.stats, c);
  restoreMarket(w, s.market, c);
  restoreOrders(rules, w, s.orders, c);
  restoreTutorial(rules, w, s.tutorial);
  if (isObj(s.chapters)) {
    const ended = s.chapters.ended === true;
    w.chapters = {
      index: int(s.chapters.index, 0, rules.chapters.length, 0),
      ended,
      endedAt: ended && s.chapters.endedAt !== null ? num(s.chapters.endedAt, 0, 1e9, w.time) : null,
      challenge: int(s.chapters.challenge, 0, 1e6, 0),
    };
    if (w.chapters.index >= rules.chapters.length) w.chapters.ended = true;
  }
  if (isObj(s.records)) {
    w.records = {
      earnRate: num(s.records.earnRate, 0, 1e9, 0),
      rate: c.counts(s.records.rate, (k) => c.itemId(k) !== null && rules.items[k].price > 0, 1e7),
    };
  }
  w.stationsVersion += 1;
  return { world: w, dropped };
}

const STATUS = ['running', 'idle', 'blocked', 'growing', 'ready'];
const GATE_REASONS = ['unset', 'done', 'no-stock', 'no-source', 'blocked', null];
const READER_REASONS = ['no-gate', 'no-order', 'no-stock', 'busy', 'assigned'];

function restoreStations(rules, w, list, c) {
  // 처음 배치된 작업대는 새 월드의 것을 기준으로 (저장 파일로 철거 불가 기계를 끼워 넣지 못하게)
  const defaults = w.stations;
  for (const st of defaults) for (let y = st.y; y < st.y + st.h; y++) for (let x = st.x; x < st.x + st.w; x++) setOccupant(w.grid, x, y, null);
  w.stations = [];
  const usedIds = new Set();
  let dropped = 0;

  const fits = (type, x, y, rot) => {
    const [sw, sh] = rotatedSize(rules.machines[type], rot);
    for (let j = y; j < y + sh; j++) {
      for (let i = x; i < x + sw; i++) {
        if (!inBounds(w.grid, i, j) || getTile(w.grid, i, j) !== TILE.FLOOR || getOccupant(w.grid, i, j) !== null) return false;
      }
    }
    return true;
  };
  const add = (st) => {
    w.stations.push(st);
    usedIds.add(st.id);
    const solid = !rules.machines[st.type].walkable;
    for (let j = st.y; j < st.y + st.h; j++) for (let i = st.x; i < st.x + st.w; i++) setOccupant(w.grid, i, j, st.id, solid);
  };

  const saved = Array.isArray(list) ? list.slice(0, 20000) : [];
  for (const raw of saved) {
    if (!isObj(raw) || typeof raw.type !== 'string' || !Object.hasOwn(rules.machines, raw.type)) { dropped++; continue; }
    const machine = rules.machines[raw.type];
    const built = raw.built === true;
    const rot = oneOf(raw.rot, [0, 1, 2, 3], 0);
    const def = built ? null : defaults.find((d) => d.type === raw.type && d.x === raw.x && d.y === raw.y);
    if ((built && !machine.cost) || (!built && !def) || !Number.isInteger(raw.x) || !Number.isInteger(raw.y)) { dropped++; continue; }
    const x = raw.x;
    const y = raw.y;
    const r = built ? rot : def.rot;
    if (!fits(raw.type, x, y, r)) { dropped++; continue; }
    const id = Number.isInteger(raw.id) && raw.id > 0 && !usedIds.has(raw.id) ? raw.id : null;
    const st = createStation(id ?? -1, { type: raw.type, x, y, rot: r, built, item: def?.item }, machine);
    restoreState(rules, w, st, raw, c);
    add(st);
  }
  // 저장에 없던 처음 작업대는 자리가 비어 있으면 다시 놓는다
  for (const d of defaults) {
    if (w.stations.some((st) => !st.built && st.type === d.type && st.x === d.x && st.y === d.y)) continue;
    if (fits(d.type, d.x, d.y, d.rot)) add({ ...d, id: -1 });
  }
  // 번호가 없거나 겹친 기계에 새 번호
  let next = Math.max(0, ...usedIds) + 1;
  for (const st of w.stations) {
    if (st.id > 0) continue;
    st.id = next++;
    for (let j = st.y; j < st.y + st.h; j++) for (let i = st.x; i < st.x + st.w; i++) setOccupant(w.grid, i, j, st.id, !rules.machines[st.type].walkable);
  }
  w.nextStationId = Math.max(next, ...w.stations.map((st) => st.id + 1));
  return dropped;
}

/** 기계 안 상태를 종류별로 확인해서 옮긴다 */
function restoreState(rules, w, st, raw, c) {
  const m = rules.machines[st.type];
  st.status = oneOf(raw.status, STATUS, st.status);
  st.progress = num(raw.progress, 0, 1e4, 0);
  st.contents = c.items(raw.contents);
  st.output = c.items(raw.output);
  if (st.hist !== undefined) st.hist = typeof raw.hist === 'string' && /^[rib]*$/.test(raw.hist) ? raw.hist.slice(-HISTORY_SECONDS) : '';
  if (upgradable(rules, st)) {
    const level = int(raw.level, 0, rules.game.upgrades.costs.length, 0);
    if (level > 0) st.level = level;
  }

  const beltEntry = (node, e) => {
    const item = c.itemId(e?.item);
    if (!item) return null;
    return { ...makeBeltItem(node, item, num(e.pos, 0, 1, 0)), tag: c.tag(e.tag), bag: c.bag(e.bag) };
  };

  switch (m.kind) {
    case 'source':
      st.contents = [];
      st.output = [];
      break;
    case 'supply': {
      const item = c.itemId(raw.item);
      st.item = item && m.supplies.includes(item) && w.unlocked.supplies.includes(item) ? item : m.supplies[0];
      st.output = st.output.slice(0, m.outputCap).filter((id) => m.supplies.includes(id));
      st.contents = [];
      break;
    }
    case 'machine':
      st.output = st.output.slice(0, m.outputCap);
      break;
    case 'belt': {
      st.items = [];
      const list = Array.isArray(raw.items) ? raw.items.slice(0, 3) : [];
      for (const e of list.map((x) => beltEntry(st, x)).filter(Boolean).sort((a, b) => b.pos - a.pos)) {
        if (canInsertAt(st.items, e.pos)) insertSorted(st.items, e);
      }
      st.jam = num(raw.jam, 0, 1, 0);
      st.idle = num(raw.idle, 0, 1, 0);
      st.contents = [];
      st.output = [];
      break;
    }
    case 'splitter':
    case 'merger':
      st.buffer = isObj(raw.buffer) ? beltEntry(st, raw.buffer) : null;
      st.toggle = oneOf(raw.toggle, [0, 1], 0);
      st.rr = int(raw.rr, 0, 3, 0);
      break;
    case 'inserter':
      st.held = c.itemId(raw.held);
      st.t = num(raw.t, 0, 60, 0);
      st.dropped = bool(raw.dropped);
      break;
    case 'storage': {
      st.capMult = zoneMult(w, rules, st, 'storage');
      const cap = Math.floor(m.capacity * st.capMult);
      st.stock = {};
      let total = 0;
      for (const [id, n] of Object.entries(c.counts(raw.stock, (k) => c.itemId(k) !== null && rules.items[k].category !== 'bundle'))) {
        const take = Math.min(n, cap - total);
        if (take <= 0) break;
        if (m.singleItem && Object.keys(st.stock).length > 0) break;
        st.stock[id] = take;
        total += take;
      }
      st.filter = c.itemId(raw.filter);
      break;
    }
    case 'gate': {
      const mode = isObj(raw.mode) ? raw.mode : {};
      st.mode = {
        kind: oneOf(mode.kind, ['manual', 'order'], 'manual'),
        item: c.itemId(mode.item),
        count: int(mode.count, 1, 999, 1),
        repeat: bool(mode.repeat),
        sent: int(mode.sent, 0, 999, 0),
        orderId: c.tag(mode.orderId),
        orderSent: c.counts(mode.orderSent, c.itemId, 999),
        auto: bool(mode.auto),
      };
      st.t = num(raw.t, 0, 60, 0);
      st.reason = oneOf(raw.reason, GATE_REASONS, 'unset');
      break;
    }
    case 'generator':
      st.fuelLeft = num(raw.fuelLeft, 0, m.burnSeconds, 0);
      st.contents = st.contents.filter((id) => id === m.fuel).slice(0, m.fuelCap);
      st.output = [];
      break;
    case 'farm':
      st.growth = num(raw.growth, 0, m.growSeconds, 0);
      st.output = st.output.filter((id) => id === m.crop).slice(0, m.yield);
      st.contents = [];
      break;
    case 'reader':
      st.t = num(raw.t, 0, 60, 0);
      st.reason = oneOf(raw.reason, READER_REASONS, 'no-gate');
      st.last = c.tag(raw.last);
      break;
    case 'bundler': {
      st.packs = {};
      for (const [k, p] of entries(raw.packs).slice(0, LIMIT.packs)) {
        const id = Number(k);
        const pack = c.counts(p, c.itemId, 999);
        if (Number.isInteger(id) && id > 0 && Object.keys(pack).length) st.packs[id] = pack;
      }
      st.out = (Array.isArray(raw.out) ? raw.out.slice(0, LIMIT.list) : [])
        .map((e) => ({ item: c.itemId(e?.item), tag: c.tag(e?.tag), bag: c.bag(e?.bag) }))
        .filter((e) => e.item && (rules.items[e.item].category !== 'bundle' || e.bag));
      st.t = num(raw.t, 0, 60, 0);
      break;
    }
    default:
      break;
  }
}

function restorePlayer(rules, w, raw, c) {
  const p = w.player;
  if (!isObj(raw)) return;
  const x = num(raw.x, 0, w.grid.width, p.x);
  const y = num(raw.y, 0, w.grid.height, p.y);
  if (!isSolid(w.grid, Math.floor(x), Math.floor(y))) {
    p.x = x;
    p.y = y;
  }
  p.prevX = p.x;
  p.prevY = p.y;
  p.dir = oneOf(raw.dir, ['up', 'down', 'left', 'right'], 'down');
  const inv = Array.isArray(raw.inventory) ? raw.inventory : [];
  p.inventory = p.inventory.map((_, i) => c.itemId(inv[i]));
}

function restoreStats(rules, w, raw, c) {
  if (!isObj(raw)) return;
  const st = w.stats;
  st.sold = c.counts(raw.sold);
  st.earned = num(raw.earned, 0, 1e12, 0);
  st.built = c.counts(raw.built, (k) => Object.hasOwn(rules.machines, k));
  const o = isObj(raw.orders) ? raw.orders : {};
  st.orders = { done: int(o.done, 0, 1e9, 0), failed: int(o.failed, 0, 1e9, 0), auto: int(o.auto, 0, 1e9, 0), bundled: int(o.bundled, 0, 1e9, 0) };
  st.timeline = (Array.isArray(raw.timeline) ? raw.timeline.slice(-BUCKETS) : [])
    .filter((b) => isObj(b) && fin(b.t0))
    .map((b) => ({ t0: b.t0, produced: c.counts(b.produced), consumed: c.counts(b.consumed), sold: c.counts(b.sold), earned: num(b.earned, 0, 1e12, 0) }));
}

function restoreMarket(w, raw, c) {
  if (!isObj(raw)) return;
  const mults = (v) => {
    const out = {};
    for (const [k, n] of entries(v)) if (c.itemId(k) && fin(n)) out[k] = Math.min(10, Math.max(0.1, n));
    return out;
  };
  w.market = {
    mult: mults(raw.mult),
    target: mults(raw.target),
    nextShift: num(raw.nextShift, 0, 1e9, 0),
    headline: c.itemId(raw.headline),
  };
}

function restoreOrders(rules, w, raw, c) {
  if (!isObj(raw)) return;
  const list = [];
  const sellable = (k) => c.itemId(k) !== null && rules.items[k].price > 0;
  for (const o of Array.isArray(raw.list) ? raw.list.slice(0, LIMIT.orders) : []) {
    if (!isObj(o) || !Number.isInteger(o.id) || o.id < 1 || list.some((x) => x.id === o.id)) continue;
    if (typeof o.kind !== 'string' || !Object.hasOwn(rules.orders.kinds, o.kind)) continue;
    const items = c.counts(o.items, sellable, 999);
    if (Object.keys(items).length === 0) continue;
    const state = oneOf(o.state, ['open', 'done', 'failed'], 'open');
    const look = isObj(o.look) ? o.look : {};
    list.push({
      id: o.id,
      kind: o.kind,
      items,
      delivered: c.counts(o.delivered, (k) => Object.hasOwn(items, k), 999),
      reward: int(o.reward, 0, 1e9, 0),
      createdAt: num(o.createdAt, 0, 1e9, w.time),
      deadline: o.deadline === null ? null : num(o.deadline, 0, 1e9, w.time),
      state,
      leaveAt: state === 'open' ? null : num(o.leaveAt, 0, 1e9, w.time),
      look: { hair: int(look.hair, 0, 3, 0), shirt: int(look.shirt, 0, 4, 0), seed: int(look.seed, 0, 1e6, 0) },
      auto: bool(o.auto),
    });
  }
  w.orders = {
    list,
    nextId: Math.max(int(raw.nextId, 1, 1e9, 1), ...list.map((o) => o.id + 1)),
    timer: raw.timer === null ? null : num(raw.timer, 0, 3600, null),
  };
}

function restoreTutorial(rules, w, raw) {
  if (!isObj(raw)) return;
  const track = typeof raw.track === 'string' && Object.hasOwn(rules.tutorial, raw.track) ? raw.track : null;
  const log = {};
  for (const [k, v] of entries(raw.log).slice(0, LIMIT.log)) if (v === true && /^[a-z]+:[a-z0-9_]+$/.test(k)) log[k] = true;
  w.tutorial = {
    track,
    active: track !== null && bool(raw.active),
    step: int(raw.step, 0, 100, 0),
    finished: bool(raw.finished),
    optOut: bool(raw.optOut),
    log,
  };
}

/** 같은 월드 객체를 유지한 채 내용만 바꾼다 (화면 모듈들이 world 를 붙잡고 있으므로) */
export function replaceWorld(target, source) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, source);
}
