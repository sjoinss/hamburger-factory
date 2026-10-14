// 자리 비운 동안 진행: 저장 후 다시 열거나 숨긴 탭으로 돌아오면, 비운 시간(최대 maxSeconds)만큼 공장을 빨리 돌린다.
// 한 프레임에 조금씩 (화면이 멈추지 않게) 돌리고, 끝나면 번 돈·처리한 주문을 한 줄로 알려 준다.
import { stepWorld, NO_INPUT } from '../sim/world.js';

const BUDGET_MS = 12;

export function createAway({ world, rules, hud }) {
  const cfg = rules.game.away;
  const tickDt = 1 / rules.game.ticksPerSecond;
  let job = null;

  const minutes = (s) => (s < 60 ? `${Math.round(s)}초` : `${Math.round(s / 60)}분`);

  function finish() {
    const t = world.stats.orders;
    const money = Math.round(world.money - job.money);
    const parts = [`자리 비운 ${minutes(job.seconds)}`];
    parts.push(`돈 ${money >= 0 ? '+' : ''}${money}`);
    if (t.done > job.done) parts.push(`주문 ${t.done - job.done}건`);
    if (t.failed > job.failed) parts.push(`놓친 주문 ${t.failed - job.failed}`);
    hud.banner(parts.join(' · '), 4);
    job = null;
  }

  return {
    /** 비운 시간(초)만큼 돌리기 시작. 너무 짧으면 무시 */
    start(awaySeconds) {
      if (!(awaySeconds >= cfg.minSeconds)) return false;
      const seconds = Math.min(awaySeconds, cfg.maxSeconds);
      job = {
        seconds,
        left: Math.round(seconds / tickDt),
        total: Math.round(seconds / tickDt),
        money: world.money,
        done: world.stats.orders.done,
        failed: world.stats.orders.failed,
      };
      return true;
    },
    active: () => job !== null,
    /** 매 프레임: 정해진 시간만큼만 돌린다. 이번 프레임에 돌렸으면 true */
    run() {
      if (!job) return false;
      const until = performance.now() + BUDGET_MS;
      while (job.left > 0 && performance.now() < until) {
        for (let i = 0; i < 20 && job.left > 0; i++, job.left--) stepWorld(world, NO_INPUT, tickDt, rules);
        world.events.length = 0; // 빨리 돌리는 동안의 소리·효과는 건너뛴다
      }
      if (job.left > 0) hud.banner(`자리 비운 동안 돌리는 중 ${Math.floor((1 - job.left / job.total) * 100)}%`, 1);
      else finish();
      return true;
    },
    cancel() { job = null; },
  };
}
