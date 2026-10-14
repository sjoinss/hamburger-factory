// 목표 패널 맨 위 챕터 카드, 엔딩 화면. 글은 textContent 로만.
import { currentChapter, currentChallenge, goalStatus } from '../sim/chapters.js';
import { itemChip } from './icons.js';

/** 목표 한 줄 글 */
export function goalLabel(rules, goal) {
  const item = (id) => rules.items[id].name;
  switch (goal.kind) {
    case 'sold': return `${item(goal.item)} 판매`;
    case 'rate': return `분당 ${item(goal.item)} 판매`;
    case 'built': return `${rules.machines[goal.machine].name} 짓기`;
    case 'orders': return '주문 완료';
    case 'autoOrders': return '인식기가 맡긴 주문 완료';
    case 'bundled': return '묶음으로 납품';
    case 'reputation': return '평판';
    case 'zones': return '구역 매입';
    case 'earnRate': return '분당 수익';
    default: return goal.kind;
  }
}

const clock = (s) => {
  const m = Math.floor(s / 60);
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
};

export function createChapterView({ world, rules, bank }) {
  const $ = (id) => document.getElementById(id);
  const name = $('chapter-name');
  const count = $('chapter-count');
  const text = $('chapter-text');
  const goals = $('goal-list');
  const reward = $('chapter-reward');
  const records = $('records');
  const endingBtn = $('btn-ending');
  const ending = $('ending');

  function showEnding() {
    const s = world.stats;
    const rows = [
      ['플레이 시간', clock(world.chapters.endedAt ?? world.time)],
      ['총 수익', String(s.earned)],
      ['판 햄버거', String(s.sold.burger ?? 0)],
      ['처리한 주문', String(s.orders.done)],
      ['평판', String(world.reputation)],
      ['기계', `${world.stations.filter((st) => st.built).length}대`],
    ];
    $('ending-stats').replaceChildren(...rows.map(([k, v]) => {
      const div = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = k;
      dd.textContent = v;
      div.append(dt, dd);
      return div;
    }));
    const cv = $('ending-sprite');
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(bank.get('burger'), 0, 0);
    ending.hidden = false;
    $('btn-ending-close').focus();
  }
  $('btn-ending-close').addEventListener('click', () => { ending.hidden = true; });
  ending.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); ending.hidden = true; }
  });
  endingBtn.addEventListener('click', showEnding);

  /** 최고 기록 한 줄: 분당 수익 + 많이 판 품목 셋 */
  function renderRecords() {
    const rec = world.records;
    records.hidden = rec.earnRate <= 0;
    if (records.hidden) return;
    const top = Object.entries(rec.rate).sort((a, b) => b[1] - a[1]).slice(0, 3);
    records.textContent = ['최고 기록: 분당 수익 ' + rec.earnRate, ...top.map(([id, n]) => `${rules.items[id].name} ${n}`)].join(' · ');
  }

  let lastKey = null;
  return {
    showEnding,
    /** 목표 패널이 열려 있을 때 (stats 패널과 같은 0.5초 간격) */
    render() {
      renderRecords();
      endingBtn.hidden = !world.chapters.ended;
      // 엔딩 뒤에는 끝없는 도전 (장과 같은 모양으로 보여 준다)
      const challenge = currentChallenge(world, rules);
      const ch = challenge
        ? { id: `challenge${challenge.level}`, name: `도전 ${challenge.level}`, text: rules.challenge.text, goals: challenge.goals, reward: challenge.reward }
        : currentChapter(world, rules);
      if (!ch) return;
      name.textContent = ch.name;
      count.textContent = challenge ? '' : `${world.chapters.index + 1}/${rules.chapters.length}`;
      text.textContent = ch.text;
      const states = ch.goals.map((g) => goalStatus(world, rules, g));
      const key = JSON.stringify([ch.id, states]);
      if (key === lastKey) return;
      lastKey = key;
      goals.replaceChildren(...ch.goals.map((g, i) => {
        const st = states[i];
        const li = document.createElement('li');
        li.classList.toggle('is-done', st.done);
        const mark = document.createElement('span');
        mark.className = 'mark';
        mark.textContent = st.done ? '[v]' : '[ ]';
        const label = document.createElement('span');
        const waiting = st.rate && !st.done && st.have >= st.need ? ' (1분 지켜보는 중)' : '';
        label.textContent = `${goalLabel(rules, g)} ${Math.min(st.have, st.need)}/${st.need}${waiting}`;
        const bar = document.createElement('span');
        bar.className = 'goal-bar';
        bar.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span');
        fill.style.setProperty('--w', `${Math.round(Math.min(1, st.have / st.need) * 100)}%`);
        bar.append(fill);
        li.append(mark, label, bar);
        return li;
      }));
      reward.replaceChildren();
      const parts = Object.entries(ch.reward.parts);
      if (ch.reward.money || parts.length) {
        reward.append(`보상: ${ch.reward.money ? `돈 ${ch.reward.money} ` : ''}`);
        for (const [id, n] of parts) reward.append(itemChip(bank, rules, id, String(n)));
      } else {
        reward.textContent = '보상: 엔딩';
      }
    },
  };
}
