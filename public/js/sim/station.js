// 작업대/상자/출고구 상태와 규칙. 상태는 직렬화 가능한 순수 데이터.

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
    item: def.item ?? null, // 재료 상자의 품목
    contents: [], // 작업대에 올려 둔 재료
    output: [], // 완성품 (꺼내 가기 전)
    progress: 0, // 초
    active: false, // 이번 틱에 작업 중이었는가 (연출용)
  };
  if (machine.kind === 'belt') station.items = []; // 벨트 위 물건 { item, pos(0~1), x, y, px, py }
  if (machine.kind === 'splitter' || machine.kind === 'merger') {
    station.buffer = null; // 지나가는 물건 하나
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

/** 이 작업대에 item 을 더 올릴 수 있는가 */
export function canAccept(rules, station, item) {
  const machine = machineOf(rules, station);
  if (machine.kind === 'counter') return (rules.items[item]?.price ?? 0) > 0;
  if (machine.kind === 'machine') {
    // 입력 버퍼: 레시피 입력의 inputBatches 배까지 쌓아 둘 수 있다.
    const counts = countItems([...station.contents, item]);
    return rules.recipesByStation[station.type].some((r) =>
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
  return true;
}

// ── 자동 기계 ──

/** 입력 버퍼에 한 번 돌릴 만큼 재료가 있는 레시피 */
export function machineRecipe(rules, station) {
  const counts = countItems(station.contents);
  return rules.recipesByStation[station.type].find((r) =>
    Object.entries(r.inputs).every(([id, n]) => (counts[id] ?? 0) >= n)) ?? null;
}

const outputCount = (recipe) => Object.values(recipe.outputs).reduce((a, b) => a + b, 0);

/**
 * 자동 기계 한 틱. 플레이어가 누르고 있지 않아도 돌아간다.
 * @returns 이번 틱에 완성품이 나왔으면 true
 */
export function updateMachine(rules, station, dt) {
  const machine = machineOf(rules, station);
  const recipe = machineRecipe(rules, station);
  if (!recipe) {
    station.status = 'idle';
    station.progress = 0;
    return false;
  }
  if (station.output.length + outputCount(recipe) > machine.outputCap) {
    station.status = 'blocked';
    return false;
  }
  station.status = 'running';
  station.active = true;
  station.progress += dt * machine.speed;
  if (station.progress + 1e-9 < recipe.seconds) return false;
  station.progress = 0;
  for (const [id, n] of Object.entries(recipe.inputs)) {
    for (let i = 0; i < n; i++) station.contents.splice(station.contents.indexOf(id), 1);
  }
  for (const [id, n] of Object.entries(recipe.outputs)) {
    for (let i = 0; i < n; i++) station.output.push(id);
  }
  return true;
}
