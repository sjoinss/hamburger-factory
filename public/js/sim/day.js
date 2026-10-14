// 하루: 게임 시간 dayMinutes 분마다 하루가 끝나고, 그날 판매·수익·주문을 한 줄로 알린다.
// 하루 시작 때의 누적값을 기억해 두고 끝날 때 차이를 본다.

function totals(world) {
  return {
    sold: Object.values(world.stats.sold).reduce((a, b) => a + b, 0),
    earned: world.stats.earned - (world.stats.spent ?? 0), // 수익 (원료 값을 뺀)
    done: world.stats.orders.done,
    failed: world.stats.orders.failed,
  };
}

export function createDay(world = null) {
  const base = world ? totals(world) : { sold: 0, earned: 0, done: 0, failed: 0 };
  return { n: 1, start: world ? world.time : 0, base, last: null };
}

/** 1초에 한 번: 하루가 지났으면 결산 (last 에 남기고 사건으로 알린다) */
export function updateDay(world, rules) {
  const d = world.day;
  if (world.time < d.start + rules.game.dayMinutes * 60) return;
  const now = totals(world);
  const summary = {
    day: d.n,
    sold: now.sold - d.base.sold,
    earned: Math.round(now.earned - d.base.earned),
    orders: now.done - d.base.done,
    failed: now.failed - d.base.failed,
  };
  d.last = summary;
  d.n += 1;
  d.start = world.time;
  d.base = now;
  world.events.push({ type: 'dayEnd', ...summary });
}
