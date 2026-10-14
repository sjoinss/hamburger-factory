// 기계 업그레이드: 돈 + 부품으로 지은 기계의 등급을 올린다. 등급마다 빨라지고 전기도 더 쓴다.
import { missingCost, spendParts } from './parts.js';
import { zoneSpeed } from './zones.js';
import { noteTutorial } from './tutorial.js';

export const levelOf = (st) => st.level ?? 0;

/** 올릴 수 있는 종류의, 플레이어가 지은 기계인가 */
export function upgradable(rules, st) {
  return Boolean(st.built) && rules.game.upgrades.kinds.includes(rules.machines[st.type].kind);
}

/** 다음 등급 비용 { money, parts } (끝 등급이면 null) */
export function upgradeCost(rules, st) {
  return rules.game.upgrades.costs[levelOf(st)] ?? null;
}

/** reason: locked(기능 미해금) | kind | max | money | parts */
export function checkUpgrade(world, rules, st) {
  if (!world.features.includes('upgrades')) return { ok: false, reason: 'locked' };
  if (!upgradable(rules, st)) return { ok: false, reason: 'kind' };
  const cost = upgradeCost(rules, st);
  if (!cost) return { ok: false, reason: 'max' };
  if (world.money < cost.money) return { ok: false, reason: 'money', cost, short: cost.money - world.money };
  const missing = missingCost(world, rules, cost.parts);
  if (Object.keys(missing).length) return { ok: false, reason: 'parts', cost, missing };
  return { ok: true, cost };
}

export function upgradeStation(world, rules, st) {
  const check = checkUpgrade(world, rules, st);
  if (!check.ok) return check;
  world.money -= check.cost.money;
  spendParts(world, rules, check.cost.parts);
  st.level = levelOf(st) + 1;
  noteTutorial(world, 'ui', 'upgrade');
  world.events.push({ type: 'upgraded', machine: st.type, level: st.level, x: st.x, y: st.y });
  return { ...check, level: st.level };
}

/** 지금까지 등급에 쓴 부품 (철거하면 돌려준다. 돈은 돌려주지 않는다) */
export function upgradeParts(rules, st) {
  const out = {};
  for (const c of rules.game.upgrades.costs.slice(0, levelOf(st))) {
    for (const [id, n] of Object.entries(c.parts)) out[id] = (out[id] ?? 0) + n;
  }
  return out;
}

/** 작업 속도 배율: 등급 × 구역 */
export function speedMult(world, rules, st) {
  return (1 + rules.game.upgrades.speedPerLevel * levelOf(st)) * zoneSpeed(world, rules, st);
}

/** 전기 사용 배율 */
export function powerMult(rules, st) {
  return 1 + rules.game.upgrades.powerPerLevel * levelOf(st);
}
