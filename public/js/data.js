// data/*.json 로딩과 검증. 데이터 파일도 신뢰하지 않고 형태와 상호 참조를 확인한다.

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MACHINE_KINDS = new Set(['source', 'crafter', 'counter', 'machine', 'supply', 'belt', 'splitter', 'merger', 'inserter', 'storage', 'gate', 'farm', 'generator', 'reader', 'bundler']);
export const FEATURES = new Set(['orders', 'market', 'power', 'zones', 'blueprints', 'upgrades']);
const CONVEYOR_KINDS = new Set(['belt', 'splitter', 'merger']);
// bundle: 합류 포장기가 만드는 주문 묶음 (출고구에서만 의미가 있다)
const ITEM_CATEGORIES = new Set(['food', 'part', 'material', 'bundle']);
const ID_RE = /^[a-z][a-z0-9_]{0,31}$/;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function rejectForbiddenKeys(value, where) {
  if (value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    assert(!FORBIDDEN_KEYS.has(key), `${where}: 허용되지 않는 키 '${key}'`);
    rejectForbiddenKeys(value[key], `${where}.${key}`);
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v, min = -Infinity, max = Infinity) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isInt = (v, min, max) => Number.isInteger(v) && isNum(v, min, max);
const isStr = (v, max = 64) => typeof v === 'string' && v.length > 0 && v.length <= max;
const short = (v) => String(v).slice(0, 32);

export function validatePalette(p) {
  rejectForbiddenKeys(p, 'palette');
  assert(p && Array.isArray(p.colors), 'palette.colors 배열이 없음');
  assert(p.colors.length <= 32, `팔레트는 32색 이하여야 함 (현재 ${p.colors.length})`);
  const seen = new Set();
  for (const c of p.colors) {
    assert(typeof c.key === 'string' && c.key.length === 1 && c.key !== p.transparent, `팔레트 key 오류: ${short(c.key)}`);
    assert(!seen.has(c.key), `팔레트 key 중복: ${c.key}`);
    assert(/^#[0-9a-f]{6}$/i.test(c.hex), `팔레트 색 오류: ${c.key} ${short(c.hex)}`);
    seen.add(c.key);
  }
  return p;
}

export function validateItems(data) {
  rejectForbiddenKeys(data, 'items');
  assert(isObj(data?.items), 'items.items 객체가 없음');
  for (const [id, it] of Object.entries(data.items)) {
    assert(ID_RE.test(id), `아이템 id 오류: ${short(id)}`);
    assert(isStr(it.name, 24) && isStr(it.sprite, 32), `아이템 ${id}: name/sprite 오류`);
    assert(isNum(it.price, 0, 1e6), `아이템 ${id}: price 오류`);
    assert(ITEM_CATEGORIES.has(it.category), `아이템 ${id}: category 오류`);
    assert(it.buy === undefined || isNum(it.buy, 0, 1e6), `아이템 ${id}: buy 오류`);
  }
  return data.items;
}

export function validateMachines(data, items) {
  rejectForbiddenKeys(data, 'machines');
  assert(isObj(data?.machines), 'machines.machines 객체가 없음');
  for (const [id, m] of Object.entries(data.machines)) {
    assert(ID_RE.test(id), `기계 id 오류: ${short(id)}`);
    assert(isStr(m.name, 24) && isStr(m.sprite, 32), `기계 ${id}: name/sprite 오류`);
    assert(MACHINE_KINDS.has(m.kind), `기계 ${id}: 알 수 없는 kind ${short(m.kind)}`);
    assert(Array.isArray(m.size) && m.size.length === 2 && m.size.every((n) => isInt(n, 1, 8)), `기계 ${id}: size 오류`);
    if (m.kind === 'source') assert(isNum(m.seconds, 0.05, 600), `기계 ${id}: seconds 오류`);
    if (m.kind === 'crafter' || m.kind === 'machine') assert(isNum(m.speed, 0.01, 100), `기계 ${id}: speed 오류`);
    if (m.kind === 'machine') {
      assert(isInt(m.inputBatches, 1, 99) && isInt(m.outputCap, 1, 99), `기계 ${id}: 버퍼 크기 오류`);
    }
    if (m.kind === 'supply') {
      assert(isNum(m.seconds, 0.05, 600) && isInt(m.outputCap, 1, 99), `기계 ${id}: 입고 seconds/outputCap 오류`);
      assert(Array.isArray(m.supplies) && m.supplies.length > 0, `기계 ${id}: supplies 오류`);
      for (const item of m.supplies) assert(Object.hasOwn(items, item), `기계 ${id}: 없는 입고 품목 ${short(item)}`);
    }
    if (m.kind === 'storage') {
      assert(isInt(m.capacity, 1, 100000) && typeof m.singleItem === 'boolean', `기계 ${id}: 저장소 capacity/singleItem 오류`);
    }
    if (m.kind === 'gate' || m.kind === 'reader') assert(isNum(m.seconds, 0.05, 60), `기계 ${id}: seconds 오류`);
    if (m.kind === 'bundler') {
      assert(isNum(m.seconds, 0.05, 60) && isNum(m.passSeconds, 0.01, 60) && isInt(m.capacity, 1, 999), `기계 ${id}: 포장기 seconds/passSeconds/capacity 오류`);
      assert(m.size[0] === 1 && m.size[1] === 1, `기계 ${id}: 합류 포장기는 1×1`);
    }
    assert(m.power === undefined || isNum(m.power, 0, 10000), `기계 ${id}: power 오류`);
    if (m.kind === 'generator') {
      assert(Object.hasOwn(items, m.fuel), `기계 ${id}: 없는 연료 ${short(m.fuel)}`);
      assert(isNum(m.burnSeconds, 0.5, 3600) && isInt(m.fuelCap, 1, 999) && isNum(m.output, 1, 100000), `기계 ${id}: 발전기 수치 오류`);
    }
    if (m.kind === 'farm') {
      assert(Object.hasOwn(items, m.crop), `기계 ${id}: 없는 작물 ${short(m.crop)}`);
      assert(isNum(m.growSeconds, 0.5, 3600) && isInt(m.yield, 1, 99) && isNum(m.harvestSeconds, 0.05, 60), `기계 ${id}: 밭 수치 오류`);
    }
    if (CONVEYOR_KINDS.has(m.kind)) {
      assert(isNum(m.speed, 0.1, 20), `기계 ${id}: 벨트 speed 오류`);
      assert(m.size[0] === 1 && m.size[1] === 1, `기계 ${id}: 벨트류는 1×1`);
    }
    if (m.kind === 'inserter') {
      assert(isNum(m.seconds, 0.1, 60) && isStr(m.armSprite, 32), `기계 ${id}: 투입기 seconds/armSprite 오류`);
      assert(m.size[0] === 1 && m.size[1] === 1, `기계 ${id}: 투입기는 1×1`);
    }
    for (const flag of ['walkable', 'dragPlace']) {
      assert(m[flag] === undefined || typeof m[flag] === 'boolean', `기계 ${id}: ${flag} 오류`);
    }
    if (m.cost !== undefined) {
      assert(isObj(m.cost) && Object.keys(m.cost).length > 0, `기계 ${id}: cost 오류`);
      for (const [part, n] of Object.entries(m.cost)) {
        assert(Object.hasOwn(items, part) && items[part].category === 'part', `기계 ${id}: 부품이 아닌 비용 ${short(part)}`);
        assert(isInt(n, 1, 999), `기계 ${id}: 비용 수량 오류`);
      }
    }
  }
  return data.machines;
}

export function validateRecipes(data, items, machines) {
  rejectForbiddenKeys(data, 'recipes');
  assert(Array.isArray(data?.recipes), 'recipes.recipes 배열이 없음');
  const ids = new Set();
  const checkCounts = (obj, where) => {
    assert(isObj(obj) && Object.keys(obj).length > 0, `${where} 비어 있음`);
    for (const [item, n] of Object.entries(obj)) {
      assert(Object.hasOwn(items, item), `${where}: 없는 아이템 ${short(item)}`);
      assert(isInt(n, 1, 99), `${where}: 수량 오류`);
    }
  };
  for (const r of data.recipes) {
    assert(ID_RE.test(r.id) && !ids.has(r.id), `레시피 id 오류/중복: ${short(r.id)}`);
    ids.add(r.id);
    assert(isStr(r.verb, 12), `레시피 ${r.id}: verb 오류`);
    assert(Array.isArray(r.stations) && r.stations.length > 0, `레시피 ${r.id}: stations 오류`);
    for (const s of r.stations) {
      const kind = Object.hasOwn(machines, s) ? machines[s].kind : null;
      assert(kind === 'crafter' || kind === 'machine', `레시피 ${r.id}: 작업할 수 없는 기계 ${short(s)}`);
    }
    checkCounts(r.inputs, `레시피 ${r.id}.inputs`);
    checkCounts(r.outputs, `레시피 ${r.id}.outputs`);
    assert(isNum(r.seconds, 0.05, 600), `레시피 ${r.id}: seconds 오류`);
  }
  return data.recipes;
}

export function validateGameConfig(g, items, machines) {
  rejectForbiddenKeys(g, 'game');
  assert(isObj(g), 'game.json 형식 오류');
  assert(isInt(g.tileSize, 8, 64), 'tileSize 오류');
  assert(isInt(g.ticksPerSecond, 1, 120), 'ticksPerSecond 오류');
  assert(isInt(g.maxTicksPerFrame, 1, 1000), 'maxTicksPerFrame 오류');
  assert(Array.isArray(g.speeds) && g.speeds.every((s) => isNum(s, 0, 16)), 'speeds 오류');

  const c = g.camera;
  assert(isObj(c) && isInt(c.minZoom, 1, 16) && isInt(c.maxZoom, c.minZoom, 16), 'camera 배율 오류');
  assert(isInt(c.defaultZoom, c.minZoom, c.maxZoom) && isInt(c.mobileZoom, c.minZoom, c.maxZoom), 'camera 기본 배율 오류');
  assert(isNum(c.panTilesPerSecond, 0, 100), 'camera.panTilesPerSecond 오류');

  const pl = g.player;
  assert(isObj(pl) && isNum(pl.tilesPerSecond, 0.1, 50), 'player.tilesPerSecond 오류');
  assert(isNum(pl.hitbox, 0.1, 0.99), 'player.hitbox 오류');
  assert(isNum(pl.walkFrameSeconds, 0.01, 2), 'player.walkFrameSeconds 오류');
  assert(isInt(pl.carryCapacity, 1, 8), 'player.carryCapacity 오류');
  assert(isNum(pl.reach, 0.5, 1.5), 'player.reach 오류');

  assert(isObj(g.touch) && isNum(g.touch.pinchStep, 1.01, 4), 'touch 오류');

  assert(isNum(g.dayMinutes, 1, 1440), 'dayMinutes 오류');
  assert(isObj(g.away) && isNum(g.away.minSeconds, 1, 3600) && isNum(g.away.maxSeconds, g.away.minSeconds, 86400), 'away 오류');

  const up = g.upgrades;
  assert(isObj(up) && Array.isArray(up.kinds) && up.kinds.every((k) => k === 'machine' || k === 'supply'), 'upgrades.kinds 오류');
  assert(isNum(up.speedPerLevel, 0, 10) && isNum(up.powerPerLevel, 0, 10), 'upgrades 배율 오류');
  assert(Array.isArray(up.costs) && up.costs.length >= 1 && up.costs.length <= 10, 'upgrades.costs 오류');
  for (const [i, c] of up.costs.entries()) {
    assert(isObj(c) && isInt(c.money, 0, 1e9) && isObj(c.parts), `upgrades.costs[${i}] 오류`);
    for (const [id, n] of Object.entries(c.parts)) {
      assert(Object.hasOwn(items, id) && items[id].category === 'part' && isInt(n, 1, 9999), `upgrades.costs[${i}]: 부품 오류 ${short(id)}`);
    }
  }

  const m = g.map;
  assert(isObj(m) && isInt(m.roomWidth, 1, 512) && isInt(m.roomHeight, 1, 512) && isInt(m.wallThickness, 0, 8), 'map 오류');
  assert(isInt(m.streetRows ?? 0, 0, 8), 'map.streetRows 오류');
  const w = m.roomWidth + m.wallThickness * 2;
  const h = m.roomHeight + m.wallThickness * 2;

  assert(isObj(g.playerStart) && isInt(g.playerStart.x, 0, w - 1) && isInt(g.playerStart.y, 0, h - 1), 'playerStart 오류');
  assert(Array.isArray(g.stations) && g.stations.length <= 10000, 'stations 오류');
  for (const s of g.stations) {
    assert(machines && Object.hasOwn(machines, s.type), `알 수 없는 기계 종류: ${short(s.type)}`);
    const [sw, sh] = machines[s.type].size;
    assert(isInt(s.x, 0, w - sw) && isInt(s.y, 0, h - sh), `기계 위치 오류: ${short(s.type)} ${short(s.x)},${short(s.y)}`);
    assert(s.ripe === undefined || typeof s.ripe === 'boolean', `기계 ${short(s.type)}: ripe 오류`);
    if (machines[s.type].kind === 'source') {
      assert(Object.hasOwn(items, s.item), `재료 상자 품목 오류: ${short(s.item)}`);
    }
  }
  return g;
}

// done 조건: 아이템 기준(have/placed/sold) 또는 기계 기준(built/made/took)
const DONE_ITEM_KINDS = new Set(['have', 'placed', 'sold']);
const DONE_MACHINE_KINDS = new Set(['built', 'made', 'took', 'fed']);
const UI_TARGETS = new Set(['build', 'overlay', 'orders', 'stats']);
// ui: 기계가 아닌 화면 기능을 써 봤는가 / order: any(아무 주문) · auto(인식기가 맡긴 주문) · bundle(묶음 납품) · 주문 종류
const DONE_UI_IDS = new Set(['blueprint', 'upgrade']);
const DONE_ORDER_IDS = new Set(['any', 'auto', 'bundle']);

export function validateTutorial(data, items, machines, orders) {
  rejectForbiddenKeys(data, 'tutorial');
  assert(isObj(data?.tracks), 'tutorial.tracks 오류');
  for (const [track, steps] of Object.entries(data.tracks)) {
    assert(ID_RE.test(track) && Array.isArray(steps) && steps.length <= 100, `튜토리얼 트랙 오류: ${short(track)}`);
    for (const [i, s] of steps.entries()) {
      const where = `튜토리얼 ${track} ${i + 1}`;
      assert(isStr(s.text, 16), `${where}: text 오류`);
      assert(isObj(s.target), `${where}: target 오류`);
      const t = s.target;
      assert(t.ui !== undefined || t.station !== undefined || t.guide !== undefined, `${where}: target 비어 있음`);
      if (t.ui !== undefined) assert(UI_TARGETS.has(t.ui), `${where}: target.ui 오류`);
      if (t.station !== undefined) assert(Object.hasOwn(machines, t.station), `${where}: target.station 오류`);
      if (t.guide !== undefined) assert(Object.hasOwn(items, t.guide), `${where}: target.guide 오류`);
      if (s.target.item !== undefined) assert(Object.hasOwn(items, s.target.item), `${where}: target.item 오류`);
      assert(isObj(s.done) && Object.keys(s.done).length === 1, `${where}: done 오류`);
      const [kind, id] = Object.entries(s.done)[0];
      const ok = (DONE_ITEM_KINDS.has(kind) && Object.hasOwn(items, id)) ||
        (DONE_MACHINE_KINDS.has(kind) && Object.hasOwn(machines, id)) ||
        (kind === 'ui' && DONE_UI_IDS.has(id)) ||
        (kind === 'order' && (DONE_ORDER_IDS.has(id) || Object.hasOwn(orders.kinds, id)));
      assert(ok, `${where}: done 조건 오류`);
    }
  }
  return data.tracks;
}

function validateUnlockLists(obj, where, recipeIds, machines) {
  assert(isObj(obj), `${where} 오류`);
  for (const id of obj.recipes ?? []) assert(recipeIds.has(id), `${where}: 없는 레시피 ${short(id)}`);
  for (const id of obj.machines ?? []) assert(Object.hasOwn(machines, id), `${where}: 없는 기계 ${short(id)}`);
}

function validateParts(parts, where, items) {
  assert(isObj(parts), `${where} 오류`);
  for (const [id, n] of Object.entries(parts)) {
    assert(Object.hasOwn(items, id) && items[id].category === 'part' && isInt(n, 0, 9999), `${where}: 부품 오류 ${short(id)}`);
  }
}

export function validateProgression(data, { recipes, machines, items, tutorial }) {
  rejectForbiddenKeys(data, 'progression');
  const recipeIds = new Set(recipes.map((r) => r.id));
  const start = data?.start;
  validateUnlockLists(start, 'progression.start', recipeIds, machines);
  assert(Array.isArray(start.recipes) && Array.isArray(start.machines), 'progression.start 목록 오류');
  assert(Array.isArray(start.features ?? []) && (start.features ?? []).every((f) => FEATURES.has(f)), 'progression.start.features 오류');
  const supplyIds = new Set(Object.values(machines).filter((m) => m.kind === 'supply').flatMap((m) => m.supplies));
  for (const id of start.supplies ?? []) assert(supplyIds.has(id), `progression.start.supplies: 입고 목록에 없는 ${short(id)}`);
  validateParts(start.parts, 'progression.start.parts', items);
  assert(start.tutorial === null || Object.hasOwn(tutorial, start.tutorial), 'progression.start.tutorial 오류');

  assert(Array.isArray(data.stages) && data.stages.length <= 100, 'progression.stages 오류');
  const ids = new Set();
  for (const st of data.stages) {
    assert(ID_RE.test(st.id) && !ids.has(st.id), `단계 id 오류/중복: ${short(st.id)}`);
    ids.add(st.id);
    assert(isStr(st.name, 24), `단계 ${st.id}: name 오류`);
    assert(isObj(st.when?.sold), `단계 ${st.id}: when 오류`);
    for (const [item, n] of Object.entries(st.when.sold)) {
      assert(Object.hasOwn(items, item) && isInt(n, 1, 1e6), `단계 ${st.id}: when.sold 오류`);
    }
    validateUnlockLists(st.unlock, `단계 ${st.id}.unlock`, recipeIds, machines);
    assert((st.unlock.features ?? []).every((f) => FEATURES.has(f)), `단계 ${st.id}: features 오류`);
    for (const id of st.unlock.supplies ?? []) assert(supplyIds.has(id), `단계 ${st.id}: 입고 목록에 없는 ${short(id)}`);
    for (const id of st.unlock.machines ?? []) assert(machines[id].cost, `단계 ${st.id}: 지을 수 없는 기계 ${id}`);
    if (st.reward !== undefined) validateParts(st.reward.parts ?? {}, `단계 ${st.id}.reward.parts`, items);
    if (st.tutorial !== undefined) assert(Object.hasOwn(tutorial, st.tutorial), `단계 ${st.id}: tutorial 오류`);
  }
  return data;
}

export function validateOrders(data, items) {
  rejectForbiddenKeys(data, 'orders');
  assert(isObj(data), 'orders.json 형식 오류');
  assert(isInt(data.maxOpen, 1, 12), 'orders.maxOpen 오류');
  for (const k of ['firstSpawnSeconds', 'spawnSeconds', 'leaveSeconds']) assert(isNum(data[k], 0.1, 3600), `orders.${k} 오류`);
  assert(isNum(data.bundleBonus, 1, 5), 'orders.bundleBonus 오류');
  assert(isNum(data.minSpawnSeconds, 0.1, data.spawnSeconds) && isNum(data.repSpawnStep, 0, 60), 'orders.minSpawnSeconds/repSpawnStep 오류');
  const mk = data.market;
  assert(isObj(mk) && isNum(mk.shiftSeconds, 1, 3600) && isNum(mk.easePerSecond, 0.001, 1), 'orders.market 오류');
  assert(Array.isArray(mk.range) && isNum(mk.range[0], 0.1, 1) && isNum(mk.range[1], 1, 10), 'orders.market.range 오류');
  assert(isObj(data.kinds) && Object.keys(data.kinds).length > 0, 'orders.kinds 오류');
  for (const [id, k] of Object.entries(data.kinds)) {
    const where = `주문 종류 ${id}`;
    assert(ID_RE.test(id) && !DONE_ORDER_IDS.has(id), `${where}: id 오류`);
    assert(isStr(k.name, 8) && isNum(k.weight, 0, 100), `${where}: name/weight 오류`);
    assert(Array.isArray(k.rewardMul) && isNum(k.rewardMul[0], 0.1, 20) && isNum(k.rewardMul[1], k.rewardMul[0], 20), `${where}: rewardMul 오류`);
    assert(k.deadline === null || isNum(k.deadline, 5, 86400), `${where}: deadline 오류`);
    assert(isInt(k.repDone, -100, 100) && isInt(k.repFail, -100, 100), `${where}: rep 오류`);
    assert(Array.isArray(k.templates) && k.templates.length > 0, `${where}: templates 오류`);
    for (const t of k.templates) {
      assert(isObj(t) && Object.keys(t).length > 0, `${where}: 빈 주문`);
      for (const [item, n] of Object.entries(t)) {
        assert(Object.hasOwn(items, item) && items[item].price > 0 && isInt(n, 1, 999), `${where}: 주문 품목 오류 ${short(item)}`);
      }
    }
  }
  return data;
}

const ZONE_TRAITS = new Set(['storage', 'generator', 'supply', 'speed']);

/** 두 사각형 사이 간격 (겹치면 음수). 축마다 [간격, 다른 축 겹침 길이] */
function rectGap(a, b) {
  const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return { gx, gy };
}

export function validateZones(data, items, game, machines) {
  rejectForbiddenKeys(data, 'zones');
  assert(isObj(data) && isNum(data.basePower, 0, 100000), 'zones.basePower 오류');
  assert(Array.isArray(data.zones) && data.zones.length <= 32, 'zones.zones 오류');
  const m = game.map;
  const wall = m.wallThickness;
  // 시작 방 + 가게 앞 길 (구역이 길을 덮으면 안 된다)
  const start = { x: wall, y: wall, w: m.roomWidth, h: m.roomHeight };
  const street = { x: 0, y: m.roomHeight + wall * 2, w: m.roomWidth + wall * 2, h: m.streetRows ?? 0 };
  const placed = new Map();
  for (const z of data.zones) {
    const where = `구역 ${short(z.id)}`;
    assert(ID_RE.test(z.id) && !placed.has(z.id) && z.id !== 'base', `${where}: id 오류/중복`);
    assert(isStr(z.name, 12), `${where}: name 오류`);
    assert(isInt(z.x, wall, 4096) && isInt(z.y, wall, 4096) && isInt(z.w, 1, 256) && isInt(z.h, 1, 256), `${where}: 위치 오류`);
    // 다른 방과는 벽 두께 이상 떨어져야 한다
    for (const other of [start, ...placed.values()]) {
      const { gx, gy } = rectGap(z, other);
      assert(gx >= wall || gy >= wall, `${where}: 다른 구역과 겹침`);
    }
    if (street.h > 0) {
      const { gx, gy } = rectGap(z, street);
      assert(gx >= 0 || gy >= 0, `${where}: 가게 앞 길과 겹침`);
    }
    assert(z.requires === null || placed.has(z.requires), `${where}: requires 오류`);
    // 앞 구역(없으면 시작 방)과 벽 한 줄을 사이에 두고 맞닿아야 걸어 들어갈 수 있다
    const prev = z.requires === null ? start : placed.get(z.requires);
    const { gx, gy } = rectGap(z, prev);
    assert((gx === wall && gy < 0) || (gy === wall && gx < 0), `${where}: 앞 구역과 벽 한 줄을 두고 맞닿아야 함`);
    assert(isObj(z.cost) && isInt(z.cost.money, 0, 1e9) && isObj(z.cost.parts), `${where}: cost 오류`);
    for (const [id, n] of Object.entries(z.cost.parts)) {
      assert(Object.hasOwn(items, id) && items[id].category === 'part' && isInt(n, 1, 9999), `${where}: 부품 비용 오류 ${short(id)}`);
    }
    const t = z.trait;
    assert(isObj(t) && ZONE_TRAITS.has(t.kind) && isNum(t.mult, 1, 10) && isStr(t.text, 40), `${where}: trait 오류`);
    if (t.kind === 'speed') {
      assert(Array.isArray(t.machines) && t.machines.length > 0, `${where}: trait.machines 오류`);
      for (const id of t.machines) assert(Object.hasOwn(machines, id) && machines[id].kind === 'machine', `${where}: 속도를 올릴 수 없는 기계 ${short(id)}`);
    }
    placed.set(z.id, z);
  }
  return data;
}

const GOAL_KINDS = new Set(['sold', 'rate', 'built', 'orders', 'autoOrders', 'bundled', 'reputation', 'zones', 'earnRate']);

export function validateChapters(data, items, machines) {
  rejectForbiddenKeys(data, 'chapters');
  assert(isObj(data) && Array.isArray(data.chapters) && data.chapters.length > 0 && data.chapters.length <= 50, 'chapters 오류');
  const ids = new Set();
  for (const ch of data.chapters) {
    const where = `챕터 ${short(ch?.id)}`;
    assert(ID_RE.test(ch.id) && !ids.has(ch.id), `${where}: id 오류/중복`);
    ids.add(ch.id);
    assert(isStr(ch.name, 16) && isStr(ch.text, 40), `${where}: name/text 오류`);
    assert(Array.isArray(ch.goals) && ch.goals.length > 0 && ch.goals.length <= 4, `${where}: goals 오류`);
    for (const g of ch.goals) {
      assert(isObj(g) && GOAL_KINDS.has(g.kind) && isInt(g.n, 1, 1e7), `${where}: 목표 오류`);
      if (g.kind === 'sold' || g.kind === 'rate') assert(Object.hasOwn(items, g.item), `${where}: 목표 품목 오류`);
      if (g.kind === 'built') assert(Object.hasOwn(machines, g.machine), `${where}: 목표 기계 오류`);
    }
    assert(isObj(ch.reward) && isInt(ch.reward.money, 0, 1e9), `${where}: reward 오류`);
    validateParts(ch.reward.parts, `${where}.reward.parts`, items);
  }
  return data.chapters;
}

/** 엔딩 뒤 끝없는 도전: 분당 수익·분당 판매 목표의 시작값과 오름폭 */
export function validateChallenge(c, items) {
  rejectForbiddenKeys(c, 'challenge');
  const step = (v, where) => assert(isObj(v) && isInt(v.base, 1, 1e7) && isInt(v.step, 0, 1e7), `${where} 오류`);
  assert(isObj(c) && isStr(c.text, 40), 'chapters.challenge 오류');
  step(c.earn, 'challenge.earn');
  step(c.reward, 'challenge.reward');
  assert(Array.isArray(c.rates) && c.rates.length > 0 && c.rates.length <= 20, 'challenge.rates 오류');
  for (const r of c.rates) {
    assert(isObj(r) && Object.hasOwn(items, r.item) && items[r.item].price > 0, `challenge.rates: 품목 오류 ${short(r?.item)}`);
    step(r, `challenge.rates ${r.item}`);
  }
  return c;
}

/** 시뮬레이션이 쓰는 규칙 묶음. 순수 데이터 + 조회용 색인. */
export function buildRules({ game, items, machines, recipes, tutorial, progression, orders, zones, chapters, challenge }) {
  const recipesByStation = Object.create(null);
  for (const id of Object.keys(machines)) recipesByStation[id] = [];
  for (const r of recipes) for (const s of r.stations) recipesByStation[s].push(r);
  return { game, items, machines, recipes, recipesByStation, tutorial, progression, orders, zones, chapters, challenge };
}

export const DATA_FILES = ['palette', 'game', 'items', 'machines', 'recipes', 'tutorial', 'progression', 'orders', 'zones', 'chapters'];

export function validateAll(raw) {
  const palette = validatePalette(raw.palette);
  const items = validateItems(raw.items);
  const machines = validateMachines(raw.machines, items);
  const recipes = validateRecipes(raw.recipes, items, machines);
  const game = validateGameConfig(raw.game, items, machines);
  const orders = validateOrders(raw.orders, items);
  const tutorial = validateTutorial(raw.tutorial, items, machines, orders);
  const progression = validateProgression(raw.progression, { recipes, machines, items, tutorial });
  const zones = validateZones(raw.zones, items, game, machines);
  const chapters = validateChapters(raw.chapters, items, machines);
  const challenge = validateChallenge(raw.chapters.challenge, items);
  return { palette, rules: buildRules({ game, items, machines, recipes, tutorial, progression, orders, zones, chapters, challenge }) };
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 불러오기 실패 (${res.status})`);
  return res.json();
}

export async function loadData() {
  const files = await Promise.all(DATA_FILES.map((n) => fetchJson(`data/${n}.json`)));
  return validateAll(Object.fromEntries(DATA_FILES.map((n, i) => [n, files[i]])));
}
