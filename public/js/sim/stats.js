// 통계: 10초 단위 구간에 생산/소비/판매/수익을 쌓아 둔다 (최근 5분).

export const BUCKET_SECONDS = 10;
export const BUCKETS = 30;
/** 기계 가동 기록 길이 (초) */
export const HISTORY_SECONDS = 60;

export function createStats() {
  // orders: 끝낸 주문 수 (done 완료, failed 실패, auto 인식기가 맡긴 것, bundled 묶음 납품)
  return { sold: {}, earned: 0, built: {}, timeline: [], orders: { done: 0, failed: 0, auto: 0, bundled: 0 } };
}

function bucket(world) {
  const tl = world.stats.timeline;
  const t0 = Math.floor(world.time / BUCKET_SECONDS) * BUCKET_SECONDS;
  let b = tl[tl.length - 1];
  if (!b || b.t0 !== t0) {
    b = { t0, produced: {}, consumed: {}, sold: {}, earned: 0 };
    tl.push(b);
    if (tl.length > BUCKETS) tl.splice(0, tl.length - BUCKETS);
  }
  return b;
}

/** kind: produced | consumed | sold */
export function record(world, kind, item, n = 1) {
  const b = bucket(world);
  b[kind][item] = (b[kind][item] ?? 0) + n;
}

export function recordEarned(world, amount) {
  bucket(world).earned += amount;
}

/** 레시피 한 번: 입력 소비, 출력 생산 */
export function recordRecipe(world, recipe) {
  for (const [id, n] of Object.entries(recipe.inputs)) record(world, 'consumed', id, n);
  for (const [id, n] of Object.entries(recipe.outputs)) record(world, 'produced', id, n);
}

/** 최근 60초 품목별 분당 수치 { item: { produced, consumed, sold } } */
export function perMinute(world) {
  const since = world.time - 60;
  const out = {};
  for (const b of world.stats.timeline) {
    if (b.t0 + BUCKET_SECONDS <= since) continue;
    for (const kind of ['produced', 'consumed', 'sold']) {
      for (const [id, n] of Object.entries(b[kind])) {
        out[id] ??= { produced: 0, consumed: 0, sold: 0 };
        out[id][kind] += n;
      }
    }
  }
  // 시작한 지 60초가 안 됐으면 지난 시간 기준으로 환산
  const span = Math.min(60, Math.max(BUCKET_SECONDS, world.time));
  for (const v of Object.values(out)) for (const k of Object.keys(v)) v[k] = Math.round((v[k] * 60) / span);
  return out;
}

/** 최근 60초 수익 (분당) */
export function earnedPerMinute(world) {
  const since = world.time - 60;
  let sum = 0;
  for (const b of world.stats.timeline) if (b.t0 + BUCKET_SECONDS > since) sum += b.earned;
  const span = Math.min(60, Math.max(BUCKET_SECONDS, world.time));
  return Math.round((sum * 60) / span);
}

/** 기계 상태 기록 (초마다 한 글자: r 가동, i 대기, b 막힘) */
export function sampleHistory(station) {
  const code = { running: 'r', idle: 'i', blocked: 'b' }[station.status] ?? 'i';
  station.hist = ((station.hist ?? '') + code).slice(-HISTORY_SECONDS);
}

/** 최근 기록 비율 { running, idle, blocked, seconds } (0~1) */
export function utilization(station, seconds = HISTORY_SECONDS) {
  const h = (station.hist ?? '').slice(-seconds);
  const n = h.length || 1;
  const count = (c) => [...h].filter((x) => x === c).length / n;
  return { running: count('r'), idle: count('i'), blocked: count('b'), seconds: h.length };
}
