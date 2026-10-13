// 시뮬레이션 난수. 상태(world.rng)에 씨앗을 저장해 같은 씨앗이면 같은 결과 (테스트·저장 재현).

/** 0 이상 1 미만 (mulberry32) */
export function random(world) {
  world.rng = (world.rng + 0x6d2b79f5) | 0;
  let t = world.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randomRange = (world, a, b) => a + (b - a) * random(world);
export const randomInt = (world, n) => Math.floor(random(world) * n);
export const pick = (world, list) => list[randomInt(world, list.length)];

/** { key: weight } 에서 무게에 비례해 하나 */
export function pickWeighted(world, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let r = random(world) * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}
