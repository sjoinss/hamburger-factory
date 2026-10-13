// 챕터 목표: 장마다 목표 몇 개. 다 채우면 보상을 받고 다음 장, 마지막 장을 끝내면 엔딩 (그 뒤로는 샌드박스).
// 목표는 장을 시작한 뒤가 아니라 지금까지의 누적/현재 값으로 본다 (먼저 해 둔 것도 인정).
import { perMinute, earnedPerMinute } from './stats.js';

/** 분당 목표는 1분은 지켜봐야 인정한다 (시작 직후 몇 초로 부풀려지지 않게) */
export const RATE_MIN_SECONDS = 60;

export function createChapters() {
  return { index: 0, ended: false, endedAt: null };
}

export function currentChapter(world, rules) {
  return rules.chapters[world.chapters.index] ?? null;
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

/** 1초에 한 번: 지금 장의 목표를 다 채웠으면 보상 + 다음 장 (한 번에 여러 장도 넘어간다) */
export function updateChapters(world, rules) {
  const ch = world.chapters;
  while (!ch.ended) {
    const chapter = currentChapter(world, rules);
    if (!chapter || !chapter.goals.every((g) => goalStatus(world, rules, g).done)) return;
    world.money += chapter.reward.money;
    for (const [id, n] of Object.entries(chapter.reward.parts)) world.parts[id] = (world.parts[id] ?? 0) + n;
    ch.index += 1;
    world.events.push({ type: 'chapterDone', chapter: chapter.id, reward: chapter.reward });
    if (ch.index >= rules.chapters.length) {
      ch.ended = true;
      ch.endedAt = world.time;
      world.events.push({ type: 'ending' });
    }
  }
}
