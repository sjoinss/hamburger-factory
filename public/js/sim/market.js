// 시장 시세: 품목마다 ±20% 안에서 완만하게 움직인다. 가장 비싼 품목이 '오늘의 인기'.
import { randomRange } from './rng.js';

export function createMarket() {
  return { mult: {}, target: {}, nextShift: 0, headline: null };
}

/** 지금 만들 수 있는 품목 (해금된 레시피의 결과물) */
export function producible(world, rules) {
  const out = new Set();
  for (const r of rules.recipes) if (world.unlocked.recipes.includes(r.id)) for (const id of Object.keys(r.outputs)) out.add(id);
  return out;
}

const sellableNow = (world, rules) => {
  const can = producible(world, rules);
  return Object.keys(rules.items).filter((id) => rules.items[id].price > 0 && can.has(id));
};

export function updateMarket(world, rules, dt) {
  if (!world.features.includes('market')) return;
  const cfg = rules.orders.market;
  const mk = world.market;
  if (world.time >= mk.nextShift) {
    const ids = sellableNow(world, rules);
    for (const id of ids) mk.target[id] = randomRange(world, cfg.range[0], cfg.range[1]);
    mk.headline = ids.reduce((best, id) => (mk.target[id] > (mk.target[best] ?? 0) ? id : best), null);
    mk.nextShift = world.time + cfg.shiftSeconds;
  }
  // 목표 시세 쪽으로 초당 easePerSecond 비율만큼 다가간다 (0.05 → 약 20초에 걸쳐 따라감)
  const k = Math.min(1, cfg.easePerSecond * dt);
  for (const id of Object.keys(mk.target)) {
    const m = mk.mult[id] ?? 1;
    mk.mult[id] = m + ((mk.target[id] ?? 1) - m) * k;
  }
}

/** 지금 출고구 시세 (시장 기능이 열리기 전에는 기본값) */
export function marketPrice(world, rules, item) {
  const base = rules.items[item].price;
  if (!world.features.includes('market') || base <= 0) return base;
  return Math.max(1, Math.round(base * (world.market.mult[item] ?? 1)));
}
