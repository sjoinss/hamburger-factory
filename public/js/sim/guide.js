// 길잡이 화살표: 목표 품목(예: 햄버거)을 만들려면 지금 어디로 가면 되는지 한 곳만 고른다.
// 글로 순서를 알려 주는 대신, 손에 든 것과 작업대 상태를 보고 다음 갈 곳을 가리킨다.
//   1. 다 올려서 작업만 하면 되는 작업대 (길게 누르기)
//   2. 손에 든 재료를 받아 주는 작업대 (목표에 쓰이는 레시피만)
//   3. 모자란 재료를 거꾸로 따라가서 그 재료가 나오는 곳 (상자·밭·작업대). 여러 개면 가까운 곳
import { canAccept, readyRecipe } from './station.js';

const MAX_DEPTH = 8;

/** 사람 손으로 하는 곳 (자동 기계는 길잡이 대상이 아니다) */
const MANUAL = new Set(['crafter', 'source', 'farm']);

/** goal 을 만드는 데 쓰이는 품목 전부 (goal 포함) */
function ingredientsOf(world, rules, goal) {
  const out = new Set([goal]);
  const queue = [goal];
  while (queue.length) {
    const item = queue.pop();
    for (const r of rules.recipes) {
      if (!r.outputs[item] || !world.unlocked.recipes.includes(r.id)) continue;
      for (const id of Object.keys(r.inputs)) if (!out.has(id)) { out.add(id); queue.push(id); }
    }
  }
  return out;
}

/** 플레이어와 기계 가운데 사이 거리 */
const distance = (world, st) => Math.hypot(st.x + st.w / 2 - world.player.x, st.y + st.h / 2 - world.player.y);

const manualStations = (world, rules) => world.stations.filter((s) => MANUAL.has(rules.machines[s.type].kind));

/** item 을 얻으려면 갈 곳 (재귀: 재료가 모자라면 그 재료 쪽으로) */
function sourceOf(world, rules, item, held, depth) {
  if (depth > MAX_DEPTH) return null;
  const stations = manualStations(world, rules);
  // 이미 다 만들어져 꺼내기만 하면 되는 곳
  const ready = stations.find((s) => rules.machines[s.type].kind !== 'source' && s.output.includes(item));
  if (ready) return ready;
  const crate = stations.find((s) => rules.machines[s.type].kind === 'source' && s.item === item);
  if (crate) return crate;
  const field = stations.find((s) => rules.machines[s.type].kind === 'farm' && rules.machines[s.type].crop === item);
  if (field) return field;
  for (const r of rules.recipes) {
    if (!r.outputs[item] || !world.unlocked.recipes.includes(r.id)) continue;
    const st = stations.find((s) => r.stations.includes(s.type) && rules.machines[s.type].kind === 'crafter');
    if (!st) continue;
    // 이 작업대에 이미 올린 재료는 빼고, 손에 든 재료도 뺀 나머지 중 첫 번째
    const placed = [...st.contents];
    const need = [];
    for (const [id, n] of Object.entries(r.inputs)) {
      for (let i = 0; i < n; i++) {
        const k = placed.indexOf(id);
        if (k !== -1) placed.splice(k, 1);
        else need.push(id);
      }
    }
    for (const id of held) {
      const k = need.indexOf(id);
      if (k !== -1) need.splice(k, 1);
    }
    if (need.length === 0) return st; // 재료는 다 있다: 여기로 가져와서 작업
    const options = [...new Set(need)].map((id) => sourceOf(world, rules, id, held, depth + 1)).filter(Boolean);
    if (options.length === 0) return st;
    return options.reduce((best, o) => (distance(world, o) < distance(world, best) ? o : best));
  }
  return null;
}

/** 목표 품목을 향해 지금 갈 곳 (없으면 null) */
export function guideTarget(world, rules, goal) {
  const held = world.player.inventory.filter(Boolean);
  if (held.includes(goal)) return null;
  const useful = ingredientsOf(world, rules, goal);
  const stations = manualStations(world, rules);
  const leads = (st) => rules.recipesByStation[st.type].some((r) => Object.keys(r.outputs).some((id) => useful.has(id)));

  // 1. 다 올려 둔 작업대: 길게 눌러 작업
  const ready = stations.find((s) => rules.machines[s.type].kind === 'crafter' && readyRecipe(rules, s) && leads(s));
  if (ready) return ready;
  // 2. 든 재료를 받아 주는 곳 (목표 쪽으로 가까운 작업대부터: 목표를 바로 만드는 곳이 먼저)
  const accepting = stations.filter((s) => rules.machines[s.type].kind === 'crafter' && leads(s) &&
    held.some((it) => useful.has(it) && it !== goal && canAccept(rules, s, it)));
  if (accepting.length) {
    const direct = accepting.find((s) => rules.recipesByStation[s.type].some((r) => r.outputs[goal]));
    return direct ?? accepting[0];
  }
  // 3. 모자란 재료의 출처
  return sourceOf(world, rules, goal, held, 0);
}
