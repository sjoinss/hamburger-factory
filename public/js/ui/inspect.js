// 선택한 기계 정보: 상태, 최근 60초 가동률, 버퍼, 입고구 품목 설정.
import { stationById } from '../sim/lookup.js';
import { utilization, HISTORY_SECONDS } from '../sim/stats.js';
import { setSupplyItem } from '../sim/station.js';
import { spriteIcon } from './icons.js';
import { machineStatusText } from './hud.js';

const pct = (v) => `${Math.round(v * 100)}%`;

function countList(rules, list) {
  const counts = {};
  for (const id of list) counts[id] = (counts[id] ?? 0) + 1;
  const parts = Object.entries(counts).map(([id, n]) => `${rules.items[id].name} ${n}`);
  return parts.length ? parts.join(', ') : '없음';
}

export function createInspector({ world, rules, bank }) {
  const $ = (id) => document.getElementById(id);
  const box = $('inspect');
  const empty = $('inspect-empty');
  const name = $('inspect-name');
  const status = $('inspect-status');
  const util = $('inspect-util');
  const bars = [...$('util-bar').children];
  const buffers = $('inspect-buffers');
  const pick = $('supply-pick');
  let selectedId = null;
  let pickFor = null;

  function renderSupplyPick(st) {
    const machine = rules.machines[st.type];
    if (machine.kind !== 'supply') {
      pick.hidden = true;
      pickFor = null;
      return;
    }
    pick.hidden = false;
    if (pickFor !== st.id) {
      pickFor = st.id;
      pick.replaceChildren(...machine.supplies.map((item) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.item = item;
        b.append(spriteIcon(bank, rules.items[item].sprite));
        const label = document.createElement('span');
        label.textContent = rules.items[item].name;
        b.append(label);
        b.addEventListener('click', () => setSupplyItem(rules, st, item));
        return b;
      }));
    }
    for (const b of pick.children) b.setAttribute('aria-pressed', String(b.dataset.item === st.item));
  }

  return {
    select(id) { selectedId = id; },
    selected() { return selectedId === null ? null : stationById(world, selectedId); },
    /** 패널이 열려 있을 때 매 프레임 */
    render() {
      const st = this.selected();
      if (!st) {
        if (selectedId !== null) selectedId = null; // 철거됨
        box.hidden = true;
        empty.hidden = false;
        return;
      }
      box.hidden = false;
      empty.hidden = true;
      const machine = rules.machines[st.type];
      name.textContent = machine.name;

      if (machine.kind === 'belt') {
        const state = st.jam > 0.5 ? '막힘 (꽉 차서 멈춤)' : st.idle > 0.8 ? '한산 (비어 있음)' : '흐르는 중';
        status.textContent = `${state} · 위에 ${st.items.length}개`;
        util.textContent = '';
        bars.forEach((b) => b.style.setProperty('--w', '0%'));
        buffers.textContent = '';
      } else {
        status.textContent = st.hist !== undefined || machine.kind === 'splitter' || machine.kind === 'merger'
          ? machineStatusText(st, rules)
          : '';
        if (st.hist !== undefined) {
          const u = utilization(st);
          util.textContent = `최근 ${Math.min(u.seconds, HISTORY_SECONDS)}초: 가동 ${pct(u.running)} · 입력 대기 ${pct(u.idle)} · 출력 막힘 ${pct(u.blocked)}`;
          bars[0].style.setProperty('--w', pct(u.running));
          bars[1].style.setProperty('--w', pct(u.idle));
          bars[2].style.setProperty('--w', pct(u.blocked));
        } else {
          util.textContent = '';
          bars.forEach((b) => b.style.setProperty('--w', '0%'));
        }
        const parts = [];
        if (st.contents?.length) parts.push(`입력: ${countList(rules, st.contents)}`);
        if (st.output?.length) parts.push(`출력: ${countList(rules, st.output)}`);
        if (st.held) parts.push(`집게: ${rules.items[st.held].name}`);
        buffers.textContent = parts.join(' / ');
      }
      renderSupplyPick(st);
    },
  };
}
