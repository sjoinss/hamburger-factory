// 건설 재료(부품) 계산: 손에 받은 부품(world.parts) + 호퍼·사일로에 쌓인 부품.
// 부품 공방 라인이 호퍼에 모아 둔 부품을 건설 메뉴가 바로 꺼내 쓴다.

const storages = (world, rules) => world.stations.filter((s) => rules.machines[s.type].kind === 'storage');

export function partCount(world, rules, id) {
  let n = world.parts[id] ?? 0;
  for (const st of storages(world, rules)) n += st.stock[id] ?? 0;
  return n;
}

/** 모자란 부품 { id: 부족한 수 } (없으면 빈 객체) */
export function missingCost(world, rules, cost) {
  const missing = {};
  for (const [id, n] of Object.entries(cost ?? {})) {
    const have = partCount(world, rules, id);
    if (have < n) missing[id] = n - have;
  }
  return missing;
}

/** 부품을 쓴다: 받은 부품부터, 모자라면 저장소에서. 미리 missingCost 로 확인할 것. */
export function spendParts(world, rules, cost) {
  for (const [id, n] of Object.entries(cost ?? {})) {
    let left = n;
    const own = Math.min(left, world.parts[id] ?? 0);
    world.parts[id] = (world.parts[id] ?? 0) - own;
    left -= own;
    for (const st of storages(world, rules)) {
      if (left <= 0) break;
      const take = Math.min(left, st.stock[id] ?? 0);
      if (take <= 0) continue;
      st.stock[id] -= take;
      if (st.stock[id] === 0) delete st.stock[id];
      left -= take;
    }
  }
}
