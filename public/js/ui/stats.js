// 통계 패널: 최근 5분 수익 막대 그래프 (10초 단위) + 지난 하루 결산 + 품목별 분당 표.
import { perMinute, BUCKET_SECONDS, BUCKETS } from '../sim/stats.js';

/** 하루 결산 한 줄 (배너와 통계 패널이 같이 쓴다) */
export function daySummaryText(d) {
  const parts = [`판매 ${d.sold}`, `수익 ${d.earned >= 0 ? '+' : ''}${d.earned}`];
  if (d.orders) parts.push(`주문 ${d.orders}건`);
  if (d.failed) parts.push(`놓친 주문 ${d.failed}`);
  return parts.join(' · ');
}
import { spriteIcon } from './icons.js';

const BAR_W = 3; // 막대 3px + 간격 1px (도트 단위)
const CHART_H = 40;
const BASE_Y = CHART_H - 2;

export function createStatsPanel({ world, rules, bank }) {
  const canvas = document.getElementById('earn-chart');
  const ctx = canvas.getContext('2d');
  const earnedEl = document.getElementById('stats-earned');
  const hoverEl = document.getElementById('earn-hover');
  const body = document.getElementById('rate-body');
  const dayEl = document.getElementById('stats-day');
  let hoverIndex = null;
  let lastRender = -Infinity;

  /** 최근 30개 구간 (빈 구간도 0 으로 채움). 맨 끝이 지금. */
  function series() {
    const now = Math.floor(world.time / BUCKET_SECONDS) * BUCKET_SECONDS;
    const byT = new Map(world.stats.timeline.map((b) => [b.t0, b.earned]));
    return Array.from({ length: BUCKETS }, (_, i) => {
      const t0 = now - (BUCKETS - 1 - i) * BUCKET_SECONDS;
      return { t0, earned: t0 < 0 ? 0 : byT.get(t0) ?? 0, agoSeconds: now - t0 };
    });
  }

  function drawChart(data) {
    ctx.fillStyle = bank.color('K');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const max = Math.max(1, ...data.map((d) => d.earned));
    // 기준선 (흐리게)
    ctx.fillStyle = bank.color('1');
    ctx.fillRect(0, BASE_Y + 1, canvas.width, 1);
    data.forEach((d, i) => {
      if (d.earned <= 0) return;
      const h = Math.max(1, Math.round((d.earned / max) * (BASE_Y - 2)));
      ctx.fillStyle = bank.color(i === hoverIndex ? 'l' : 'o');
      ctx.fillRect(1 + i * (BAR_W + 1), BASE_Y + 1 - h, BAR_W, h);
    });
  }

  function hoverText(data) {
    if (hoverIndex === null) return '막대를 누르면 값';
    const d = data[hoverIndex];
    const ago = d.agoSeconds === 0 ? '지금 구간' : `${d.agoSeconds}초 전`;
    return `${ago}: +${d.earned}`;
  }

  function pointAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const i = Math.floor((x - 1) / (BAR_W + 1));
    hoverIndex = i >= 0 && i < BUCKETS ? i : null;
    lastRender = -Infinity; // 바로 다시 그림
  }
  canvas.addEventListener('pointermove', pointAt);
  canvas.addEventListener('pointerdown', pointAt);
  canvas.addEventListener('pointerleave', () => { hoverIndex = null; lastRender = -Infinity; });

  function renderTable() {
    const rates = perMinute(world);
    const ids = Object.keys(rules.items).filter((id) => rates[id] && (rates[id].produced || rates[id].consumed || rates[id].sold));
    if (ids.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.className = 'muted';
      td.textContent = '아직 기록 없음';
      tr.append(td);
      body.replaceChildren(tr);
      return;
    }
    body.replaceChildren(...ids.map((id) => {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.append(spriteIcon(bank, rules.items[id].sprite), rules.items[id].name);
      tr.append(name);
      for (const k of ['produced', 'consumed', 'sold']) {
        const td = document.createElement('td');
        td.textContent = String(rates[id][k]);
        tr.append(td);
      }
      return tr;
    }));
  }

  return {
    /** 열려 있을 때 매 프레임 호출. 실제 갱신은 0.5초마다 (호버는 즉시). */
    render(nowMs) {
      if (nowMs - lastRender < 500) return;
      lastRender = nowMs;
      const data = series();
      earnedEl.textContent = String(data.reduce((a, d) => a + d.earned, 0));
      const last = world.day?.last;
      dayEl.hidden = !last;
      if (last) dayEl.textContent = `지난 하루 (${last.day}일째): ${daySummaryText(last)}`;
      drawChart(data);
      hoverEl.textContent = hoverText(data);
      renderTable();
    },
  };
}
