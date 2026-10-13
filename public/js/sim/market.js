// 시장 시세: 품목마다 ±20% 안에서 완만하게 움직인다. 가장 비싼 품목이 '오늘의 인기'.
import { randomRange } from './rng.js';

export function createMarket() {
  return { mult: {}, target: {}, nextShift: 0, headline: null };
}

const sellable = (rules) => Object.keys(rules.items).filter((id) => rules.items[id].price > 0);

export function updateMarket(world, rules, dt) {
  if (!world.features.includes('market')) return;
  const cfg = rules.orders.market;
  const mk = world.market;
  if (world.time >= mk.nextShift) {
    for (const id of sellable(rules)) mk.target[id] = randomRange(world, cfg.range[0], cfg.range[1]);
    mk.headline = sellable(rules).reduce((best, id) => (mk.target[id] > (mk.target[best] ?? 0) ? id : best), null);
    mk.nextShift = world.time + cfg.shiftSeconds;
  }
  // 목표 시세 쪽으로 초당 easePerSecond 비율만큼 다가간다 (0.05 → 약 20초에 걸쳐 따라감)
  const k = Math.min(1, cfg.easePerSecond * dt);
  for (const id of sellable(rules)) {
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
