// 신선도: 녹는 품목(아이스크림 등)은 냉동이 아닌 저장소에서 조금씩 녹아 없어진다.
// 냉동 = 냉동 창고, 또는 냉동동(구역 특성 cold)에 놓은 저장소. 벨트·기계 안은 잠깐 지나가므로 녹지 않는다.
import { zoneTraitAt } from './zones.js';
import { takeFromStorage } from './storage.js';

export function isCold(world, rules, st) {
  return Boolean(rules.machines[st.type].cold || zoneTraitAt(world, rules, st.x, st.y)?.cold);
}

/** 이 저장소에서 지금 녹고 있는 품목들 */
export function melting(world, rules, st) {
  if (isCold(world, rules, st)) return [];
  return Object.keys(st.stock).filter((id) => st.stock[id] > 0 && rules.items[id].perish);
}

/** 매 틱: 품목마다 perish 초가 쌓이면 하나씩 녹는다 */
export function updateFreshness(world, rules, dt) {
  for (const st of world.stations) {
    if (rules.machines[st.type].kind !== 'storage') continue;
    const list = melting(world, rules, st);
    if (list.length === 0) {
      if (st.melt) delete st.melt;
      continue;
    }
    st.melt ??= {};
    for (const id of Object.keys(st.melt)) if (!list.includes(id)) delete st.melt[id];
    for (const id of list) {
      st.melt[id] = (st.melt[id] ?? 0) + dt;
      const perish = rules.items[id].perish;
      if (st.melt[id] >= perish) {
        st.melt[id] -= perish;
        takeFromStorage(st, id);
        world.stats.melted = (world.stats.melted ?? 0) + 1;
      }
    }
  }
}
