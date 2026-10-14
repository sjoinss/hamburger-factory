// 작업대/상자/출고구 상태와 규칙. 상태는 직렬화 가능한 순수 데이터.
import { canStore } from './storage.js';

/** 회전(0~3)을 반영한 크기. 홀수 회전이면 가로세로가 바뀐다. */
export function rotatedSize(machine, rot = 0) {
  const [w, h] = machine.size;
  return rot % 2 === 0 ? [w, h] : [h, w];
}

export function createStation(id, def, machine) {
  const rot = def.rot ?? 0;
  const [w, h] = rotatedSize(machine, rot);
  const station = {
    id,
    type: def.type,
    x: def.x,
    y: def.y,
    w,
    h,
    rot,
    built: def.built ?? false, // 플레이어가 지은 기계 (철거 가능)
    status: 'idle', // 자동 기계: running | idle | blocked
    item: def.item ?? (machine.kind === 'supply' ? machine.supplies[0] : null), // 재료 상자/입고구의 품목
    contents: [], // 작업대에 올려 둔 재료
    output: [], // 완성품 (꺼내 가기 전)
    progress: 0, // 초
    active: false, // 이번 틱에 작업 중이었는가 (연출용)
  };
  if (machine.kind === 'belt') {
    station.items = []; // 벨트 위 물건 { item, pos(0~1), x, y, px, py }
    station.jam = 0; // 꽉 차서 멈춘 정도 (부드럽게 0~1)
    station.idle = 0; // 비어 있는 정도 (부드럽게 0~1)
  }
  if (machine.kind === 'machine' || machine.kind === 'supply' || machine.kind === 'inserter' || machine.kind === 'gate') station.hist = '';
  if (machine.kind === 'generator') {
    station.fuelLeft = 0; // 지금 타는 연료가 남은 시간
    station.hist = '';
  }
  if (machine.kind === 'farm') {
    // 자라는 중인 시간. 다 자라면 output 에 수확물이 생기고, 다 거둬야 다시 자란다.
    station.growth = def.ripe ? machine.growSeconds : 0;
  }
  if (machine.kind === 'storage') {
    station.stock = {}; // { item: 수량 }
    station.filter = null; // 받을 품목 제한
  }
  if (machine.kind === 'gate') {
    // gate.js createGateMode() 와 같은 모양 (순환 import 를 피하려고 여기서 직접 만든다)
    station.mode = { kind: 'manual', item: null, count: 1, repeat: false, sent: 0, orderId: null, orderSent: {}, auto: false };
    station.t = 0;
    station.reason = 'unset';
  }
  if (machine.kind === 'reader') {
    station.t = 0;
    station.hist = '';
    station.reason = 'no-gate';
    station.last = null; // 마지막으로 게이트에 맡긴 주문 번호
  }
  if (machine.kind === 'bundler') {
    station.packs = {}; // { 주문 번호: { item: 수량 } } 모으는 중
    station.out = []; // 내보낼 물건 [{ item, tag, bag }]
    station.t = 0;
    station.hist = '';
  }
  if (machine.kind === 'splitter' || machine.kind === 'merger' || machine.kind === 'sorter') {
    station.buffer = null; // 지나가는 물건 하나
    if (machine.kind === 'sorter') station.filter = null; // 왼쪽으로 뺄 품목 (없으면 모두 앞으로)
    station.toggle = 0; // 분배기: 다음에 먼저 보낼 쪽
    station.rr = 0; // 합류기: 다음에 먼저 받을 입구
  }
  if (machine.kind === 'inserter') {
    station.held = null; // 집게에 든 물건
    station.t = 0; // 한 번 옮기는 동작 안에서의 시간
    station.dropped = false;
  }
  return station;
}

export const machineOf = (rules, station) => rules.machines[station.type];

/** 이 기계가 지금 만들 수 있는 레시피들: 만들 것을 정했으면 그것 하나, 아니면 전부 (재료가 먼저 다 찬 것) */
export function stationRecipes(rules, station) {
  const all = rules.recipesByStation[station.type];
  return station.recipe ? all.filter((r) => r.id === station.recipe) : all;
}

/**
 * 자동 기계의 만들 것을 정한다 (null = 자동). 새 레시피에 안 쓰이는 재료는 출력 칸으로 내보낸다
 * (투입기가 다른 곳으로 빼 갈 수 있게. 기계 안에 갇히지 않게).
 */
export function setMachineRecipe(rules, station, recipeId) {
  if (machineOf(rules, station).kind !== 'machine') return false;
  if (recipeId !== null && !rules.recipesByStation[station.type].some((r) => r.id === recipeId)) return false;
  station.recipe = recipeId;
  if (recipeId === null) return true;
  const r = rules.recipesByStation[station.type].find((x) => x.id === recipeId);
  const keep = [];
  for (const id of station.contents) {
    const used = keep.filter((x) => x === id).length;
    if (used < (r.inputs[id] ?? 0) * machineOf(rules, station).inputBatches) keep.push(id);
    else station.output.push(id);
  }
  station.contents = keep;
  station.progress = 0;
  return true;
}

function countItems(list) {
  const counts = Object.create(null);
  for (const id of list) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** list 의 재료가 recipe 입력의 부분집합인가 */
function fitsRecipe(list, recipe) {
  const counts = countItems(list);
  return Object.entries(counts).every(([id, n]) => (recipe.inputs[id] ?? 0) >= n);
}

function matchesRecipe(list, recipe) {
  const counts = countItems(list);
  const keys = Object.keys(recipe.inputs);
  return keys.length === Object.keys(counts).length && keys.every((id) => counts[id] === recipe.inputs[id]);
}

/**
 * 이 작업대에 item 을 더 올릴 수 있는가.
 * 출고구는 주문을 알아야 하므로 world 가 있으면 주문이 기다리는 물건도 받는다.
 */
export function canAccept(rules, station, item, world = null) {
  const machine = machineOf(rules, station);
  if (machine.kind === 'counter') {
    if ((rules.items[item]?.price ?? 0) > 0) return true;
    return world !== null && world.features.includes('orders') &&
      world.orders.list.some((o) => o.state === 'open' && (o.items[item] ?? 0) > (o.delivered[item] ?? 0));
  }
  if (machine.kind === 'storage') return canStore(rules, station, item);
  if (machine.kind === 'bundler') return false; // 번호표가 붙은 물건만 받는다 (벨트·게이트에서)
  if (machine.kind === 'generator') return Object.hasOwn(machine.fuels, item) && station.contents.length < machine.fuelCap;
  // 밭: 비료만 (정해진 개수까지)
  if (machine.kind === 'farm') {
    const fz = rules.game.fertilizer;
    return item === fz.item && station.contents.length < fz.cap;
  }
  if (machine.kind === 'machine') {
    // 입력 버퍼: 레시피 입력의 inputBatches 배까지 쌓아 둘 수 있다.
    const counts = countItems([...station.contents, item]);
    return stationRecipes(rules, station).some((r) =>
      Object.entries(counts).every(([id, n]) => n <= (r.inputs[id] ?? 0) * machine.inputBatches));
  }
  if (machine.kind !== 'crafter' || station.output.length > 0) return false;
  const next = [...station.contents, item];
  return rules.recipesByStation[station.type].some((r) => fitsRecipe(next, r));
}

/** 올려 둔 재료가 정확히 맞는 레시피 */
export function readyRecipe(rules, station) {
  if (station.contents.length === 0 || station.output.length > 0) return null;
  return rules.recipesByStation[station.type].find((r) => matchesRecipe(station.contents, r)) ?? null;
}

/** 아직 부족한 재료 목록 (가장 가까운 레시피 기준) */
export function missingInputs(rules, station) {
  const candidates = rules.recipesByStation[station.type].filter((r) => fitsRecipe(station.contents, r));
  if (candidates.length === 0) return [];
  const counts = countItems(station.contents);
  const r = candidates[0];
  const missing = [];
  for (const [id, n] of Object.entries(r.inputs)) {
    for (let i = counts[id] ?? 0; i < n; i++) missing.push(id);
  }
  return missing;
}

export function workSeconds(rules, station, recipe) {
  return recipe.seconds / machineOf(rules, station).speed;
}

/** 작업을 dt 만큼 진행. 끝나면 완성품을 output 으로 옮기고 true. */
export function advanceWork(rules, station, dt) {
  const recipe = readyRecipe(rules, station);
  if (!recipe) return false;
  station.active = true;
  station.progress += dt;
  if (station.progress + 1e-9 < workSeconds(rules, station, recipe)) return false;
  station.contents = [];
  station.progress = 0;
  for (const [id, n] of Object.entries(recipe.outputs)) {
    for (let i = 0; i < n; i++) station.output.push(id);
  }
  return recipe;
}

// ── 자동 기계 ──

/** 입력 버퍼에 한 번 돌릴 만큼 재료가 있는 레시피 */
export function machineRecipe(rules, station) {
  const counts = countItems(station.contents);
  return stationRecipes(rules, station).find((r) =>
    Object.entries(r.inputs).every(([id, n]) => (counts[id] ?? 0) >= n)) ?? null;
}

const outputCount = (recipe) => Object.values(recipe.outputs).reduce((a, b) => a + b, 0);

/** 이번에 끝나면 부산물이 나올 차례인가 */
const byproductDue = (recipe, station, on) => Boolean(on && recipe.byproduct && ((station.byCount ?? 0) + 1) % recipe.byproduct.every === 0);

/**
 * 자동 기계 한 틱. 플레이어가 누르고 있지 않아도 돌아간다.
 * byproducts: 부산물 단계가 열렸는가 (그 전에는 부산물이 나오지 않는다)
 * @returns 이번 틱에 완성품이 나왔으면 그 레시피, 아니면 null
 */
export function updateMachine(rules, station, dt, byproducts = false) {
  const machine = machineOf(rules, station);
  const recipe = machineRecipe(rules, station);
  if (!recipe) {
    station.status = 'idle';
    station.progress = 0;
    return null;
  }
  const extra = byproductDue(recipe, station, byproducts) ? 1 : 0;
  if (station.output.length + outputCount(recipe) + extra > machine.outputCap) {
    station.status = 'blocked';
    return null;
  }
  station.status = 'running';
  station.active = true;
  station.progress += dt * machine.speed;
  if (station.progress + 1e-9 < recipe.seconds) return null;
  station.progress = 0;
  for (const [id, n] of Object.entries(recipe.inputs)) {
    for (let i = 0; i < n; i++) station.contents.splice(station.contents.indexOf(id), 1);
  }
  for (const [id, n] of Object.entries(recipe.outputs)) {
    for (let i = 0; i < n; i++) station.output.push(id);
  }
  // 부산물: every 번에 한 번 (빼 주지 않으면 출력 칸이 차서 기계가 멈춘다)
  if (byproducts && recipe.byproduct) {
    if (extra) station.output.push(recipe.byproduct.item);
    station.byCount = ((station.byCount ?? 0) + 1) % recipe.byproduct.every;
  }
  return recipe;
}

// ── 밭 ──

/** 다 거둔 밭만 자란다. @returns 이번 틱에 다 자랐으면 true */
export function updateFarm(rules, station, dt) {
  const machine = machineOf(rules, station);
  if (station.output.length > 0) {
    station.status = 'ready';
    return false;
  }
  station.status = 'growing';
  // 비료가 있으면 빨리 자라고, 한 번 다 자랄 때 하나를 쓴다
  const fz = rules.game.fertilizer;
  const fed = station.contents.includes(fz.item);
  station.growth += dt * (fed ? fz.speed : 1);
  if (station.growth + 1e-9 < machine.growSeconds) return false;
  station.growth = 0;
  if (fed) station.contents.splice(station.contents.indexOf(fz.item), 1);
  for (let i = 0; i < machine.yield; i++) station.output.push(machine.crop);
  station.status = 'ready';
  return true;
}

/** 0~1 자란 정도 (다 자라 수확을 기다리면 1) */
export function farmGrowth(rules, station) {
  if (station.output.length > 0) return 1;
  return Math.min(1, station.growth / machineOf(rules, station).growSeconds);
}

// ── 입고구 ──

/** 정해진 품목을 일정 시간마다 들여온다. 출력이 꽉 차면 멈춘다. @returns 들여온 품목 또는 null */
export function updateSupply(rules, station, dt, speedMult = 1) {
  const machine = machineOf(rules, station);
  if (station.output.length >= machine.outputCap) {
    station.status = 'blocked';
    return null;
  }
  station.status = 'running';
  station.active = true;
  station.progress += dt;
  if (station.progress + 1e-9 < machine.seconds / speedMult) return null;
  station.progress = 0;
  station.output.push(station.item);
  return station.item;
}

/** world 를 주면 해금된 입고 품목만 허용 */
export function setSupplyItem(rules, station, item, world = null) {
  const machine = machineOf(rules, station);
  if (machine.kind !== 'supply' || !machine.supplies.includes(item)) return false;
  if (world && !world.unlocked.supplies.includes(item)) return false;
  if (station.item !== item) station.progress = 0;
  station.item = item;
  return true;
}
