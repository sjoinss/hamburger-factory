// 깔때기 호퍼 / 사일로: 품목별 수량으로 쌓아 둔다. 꽉 차면 받지 않아 벨트가 밀린다.

export const storageTotal = (st) => Object.values(st.stock).reduce((a, b) => a + b, 0);

/** 용량 (창고동에 놓으면 늘어난다: 놓을 때 station.capMult 로 기록) */
export const storageCapacity = (rules, st) => Math.floor(rules.machines[st.type].capacity * (st.capMult ?? 1));

/** 사일로처럼 한 품목만 받는 저장소가 지금 담고 있는 품목 */
const lockedItem = (st) => Object.keys(st.stock).find((id) => st.stock[id] > 0) ?? null;

export function canStore(rules, st, item) {
  const m = rules.machines[st.type];
  if (storageTotal(st) >= storageCapacity(rules, st)) return false;
  if (st.filter && st.filter !== item) return false;
  if (m.singleItem) {
    const locked = lockedItem(st);
    if (locked && locked !== item) return false;
  }
  return true;
}

export function store(st, item) {
  st.stock[item] = (st.stock[item] ?? 0) + 1;
}

export function takeFromStorage(st, item) {
  if (!(st.stock[item] > 0)) return false;
  st.stock[item] -= 1;
  if (st.stock[item] === 0) delete st.stock[item];
  return true;
}

/** 가장 많이 쌓인 품목 (손으로 꺼낼 때) */
export function mostStocked(st) {
  return Object.entries(st.stock).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** 받을 품목 제한. null 이면 아무거나. */
export function setStorageFilter(rules, st, item) {
  if (item !== null && !Object.hasOwn(rules.items, item)) return false;
  st.filter = item;
  return true;
}

/** 공장 전체 저장소의 품목 수 (주문서 '보유량') */
export function stockedTotal(world, rules, item) {
  let n = 0;
  for (const st of world.stations) if (rules.machines[st.type].kind === 'storage') n += st.stock[item] ?? 0;
  return n;
}
