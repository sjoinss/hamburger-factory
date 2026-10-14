// 챕터 목표: 장마다 목표 몇 개. 다 채우면 보상을 받고 다음 장, 마지막 장을 끝내면 엔딩.
// 엔딩 뒤로는 끝없는 도전: 단계마다 분당 수익 + 분당 판매 목표가 조금씩 올라간다.
// 목표는 장을 시작한 뒤가 아니라 지금까지의 누적/현재 값으로 본다 (먼저 해 둔 것도 인정).
import { perMinute, earnedPerMinute } from './stats.js';

/** 분당 목표는 1분은 지켜봐야 인정한다 (시작 직후 몇 초로 부풀려지지 않게) */
export const RATE_MIN_SECONDS = 60;

export function createChapters() {
  return { index: 0, ended: false, endedAt: null, challenge: 0 };
}

export function createRecords() {
  return { earnRate: 0, rate: {} };
}

export function currentChapter(world, rules) {
  return rules.chapters[world.chapters.index] ?? null;
}

/** 도전 단계 level(1부터)의 목표와 보상. 분당 판매 품목은 단계마다 돌아가며, 한 바퀴 돌 때마다 목표가 오른다. */
export function challengeAt(rules, level) {
  const c = rules.challenge;
  const i = level - 1;
  const r = c.rates[i % c.rates.length];
  const lap = Math.floor(i / c.rates.length);
  return {
    level,
    goals: [
      { kind: 'earnRate', n: c.earn.base + c.earn.step * i },
      { kind: 'rate', item: r.item, n: r.base + r.step * lap },
    ],
    reward: { money: c.reward.base + c.reward.step * i, parts: {} },
  };
}

/** 지금 도전 (엔딩 전이면 null) */
export function currentChallenge(world, rules) {
  return world.chapters.ended ? challengeAt(rules, world.chapters.challenge + 1) : null;
}

/** 목표 하나의 지금 값 { have, need, done } */
export function goalStatus(world, rules, goal) {
  const s = world.stats;
  let have = 0;
  let rateGoal = false;
  switch (goal.kind) {
    case 'sold': have = s.sold[goal.item] ?? 0; break;
    case 'built': have = world.stations.filter((st) => st.type === goal.machine).length; break;
    case 'orders': have = s.orders.done; break;
    case 'autoOrders': have = s.orders.auto; break;
    case 'bundled': have = s.orders.bundled; break;
    case 'reputation': have = world.reputation; break;
    case 'zones': have = world.zonesBought.length; break;
    case 'rate': have = perMinute(world)[goal.item]?.sold ?? 0; rateGoal = true; break;
    case 'earnRate': have = earnedPerMinute(world); rateGoal = true; break;
    default: break;
  }
  const ready = !rateGoal || world.time >= RATE_MIN_SECONDS;
  return { have, need: goal.n, done: ready && have >= goal.n, rate: rateGoal };
}

function giveReward(world, reward) {
  world.money += reward.money;
  for (const [id, n] of Object.entries(reward.parts)) world.parts[id] = (world.parts[id] ?? 0) + n;
}

/** 최고 기록: 분당 수익, 품목별 분당 판매 (1분은 지난 뒤부터) */
function updateRecords(world) {
  if (world.time < RATE_MIN_SECONDS) return;
  const rec = world.records;
  rec.earnRate = Math.max(rec.earnRate, earnedPerMinute(world));
  for (const [id, v] of Object.entries(perMinute(world))) {
    if (v.sold > (rec.rate[id] ?? 0)) rec.rate[id] = v.sold;
  }
}

/** 1초에 한 번: 지금 장의 목표를 다 채웠으면 보상 + 다음 장 (한 번에 여러 장도 넘어간다) */
export function updateChapters(world, rules) {
  updateRecords(world);
  const ch = world.chapters;
  while (!ch.ended) {
    const chapter = currentChapter(world, rules);
    if (!chapter || !chapter.goals.every((g) => goalStatus(world, rules, g).done)) return;
    giveReward(world, chapter.reward);
    ch.index += 1;
    world.events.push({ type: 'chapterDone', chapter: chapter.id, reward: chapter.reward });
    if (ch.index >= rules.chapters.length) {
      ch.ended = true;
      ch.endedAt = world.time;
      world.events.push({ type: 'ending' });
      return;
    }
  }
  // 도전은 1초에 한 단계씩만 (이미 넘은 목표가 한꺼번에 쏟아지지 않게)
  const c = currentChallenge(world, rules);
  if (!c.goals.every((g) => goalStatus(world, rules, g).done)) return;
  giveReward(world, c.reward);
  ch.challenge += 1;
  world.events.push({ type: 'challengeDone', level: c.level, reward: c.reward });
}
