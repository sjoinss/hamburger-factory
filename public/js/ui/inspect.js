// 선택한 기계 정보: 상태, 최근 60초 가동률, 버퍼, 입고구 품목 설정.
import { stationById } from '../sim/lookup.js';
import { utilization, HISTORY_SECONDS } from '../sim/stats.js';
import { setSupplyItem } from '../sim/station.js';
import { storageTotal, setStorageFilter } from '../sim/storage.js';
import { setGateManual, gateSources } from '../sim/gate.js';
import { orderById } from '../sim/orders.js';
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
  const storageBox = $('storage-box');
  const stockList = $('stock-list');
  const filterRow = $('storage-filter');
  const gateBox = $('gate-box');
  const gateItemRow = $('gate-item');
  const gateCount = $('gate-count');
  const gateRepeat = $('gate-repeat');
  const gateManual = $('gate-manual');
  const gateOrderInfo = $('gate-order-info');
  const modeManual = $('gate-mode-manual');
  const modeOrder = $('gate-mode-order');

  /** 고를 수 있는 품목: 파는 물건 + (있으면) 저장소에 든 물건 */
  const choosable = (extra = []) => {
    const ids = new Set(Object.keys(rules.items).filter((id) => rules.items[id].price > 0));
    for (const id of extra) ids.add(id); // 저장소에 든 원료·부품도 고를 수 있다
    return [...ids];
  };

  /** 아이콘 버튼 줄 (같은 목록이면 다시 만들지 않고 눌림 상태만 바꾼다) */
  function itemButtons(row, ids, current, onPick, withAll = false) {
    const key = (withAll ? 'all|' : '') + ids.join(',');
    if (row.dataset.key !== key) {
      row.dataset.key = key;
      const make = (id) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.item = id ?? '';
        if (id) b.append(spriteIcon(bank, rules.items[id].sprite));
        const label = document.createElement('span');
        label.textContent = id ? rules.items[id].name : '전체';
        b.append(label);
        b.addEventListener('click', () => onPick(id));
        return b;
      };
      row.replaceChildren(...(withAll ? [make(null)] : []), ...ids.map(make));
    }
    for (const b of row.children) b.setAttribute('aria-pressed', String((b.dataset.item || null) === (current ?? null)));
  }

  // 게이트 조작 (선택된 게이트에 적용)
  const selGate = () => {
    const st = selectedId === null ? null : stationById(world, selectedId);
    return st && rules.machines[st.type].kind === 'gate' ? st : null;
  };
  const manual = (patch) => {
    const g = selGate();
    if (!g) return;
    const m = g.mode.kind === 'manual' ? g.mode : { item: null, count: 1, repeat: false };
    const next = { item: m.item, count: m.count, repeat: m.repeat, ...patch };
    setGateManual(g, next.item, next.count, next.repeat);
  };
  modeManual.addEventListener('click', () => manual({}));
  modeOrder.addEventListener('click', () => {
    const g = selGate();
    if (g && g.mode.kind !== 'order') g.mode = { ...g.mode, kind: 'order', orderId: null, orderSent: {} };
  });
  $('gate-minus').addEventListener('click', () => manual({ count: (selGate()?.mode.count ?? 1) - 1 }));
  $('gate-plus').addEventListener('click', () => manual({ count: (selGate()?.mode.count ?? 1) + 1 }));
  gateRepeat.addEventListener('click', () => manual({ repeat: !selGate()?.mode.repeat }));
  $('gate-restart').addEventListener('click', () => manual({}));

  function renderStorage(st) {
    const m = rules.machines[st.type];
    storageBox.hidden = false;
    const rows = Object.entries(st.stock).sort((a, b) => b[1] - a[1]);
    const key = JSON.stringify(rows);
    if (stockList.dataset.key !== key) {
      stockList.dataset.key = key;
      stockList.replaceChildren(...(rows.length ? rows : [[null, 0]]).map(([id, n]) => {
        const li = document.createElement('li');
        if (id) li.append(spriteIcon(bank, rules.items[id].sprite));
        const label = document.createElement('span');
        label.textContent = id ? `${rules.items[id].name} ${n}` : '비어 있음';
        li.append(label);
        return li;
      }));
    }
    status.textContent = `${storageTotal(st)} / ${m.capacity}${m.singleItem ? ' (한 가지 품목만)' : ''}`;
    itemButtons(filterRow, choosable(Object.keys(st.stock)), st.filter, (id) => setStorageFilter(rules, st, id), true);
  }

  function renderGate(st) {
    gateBox.hidden = false;
    const m = st.mode;
    modeManual.setAttribute('aria-pressed', String(m.kind === 'manual'));
    modeOrder.setAttribute('aria-pressed', String(m.kind === 'order'));
    gateManual.hidden = m.kind !== 'manual';
    const stocked = gateSources(world, rules, st).flatMap((src) => Object.keys(src.stock));
    if (m.kind === 'manual') {
      itemButtons(gateItemRow, choosable(stocked), m.item, (id) => manual({ item: id }));
      gateCount.textContent = String(m.count);
      gateRepeat.setAttribute('aria-pressed', String(m.repeat));
      gateOrderInfo.textContent = m.item ? `보낸 수 ${m.sent} / ${m.count}${m.repeat ? ' (반복)' : ''}` : '';
    } else {
      const order = orderById(world, m.orderId);
      gateOrderInfo.textContent = order
        ? `${m.auto ? '인식기가 맡긴 ' : ''}주문 #${order.id}: ${Object.entries(order.items).map(([id, n]) => `${rules.items[id].name} ${m.orderSent[id] ?? 0}/${n}`).join(', ')}`
        : '맡은 주문 없음';
    }
  }

  function renderSupplyPick(st) {
    const machine = rules.machines[st.type];
    if (machine.kind !== 'supply') {
      pick.hidden = true;
      pickFor = null;
      return;
    }
    pick.hidden = false;
    const pickKey = `${st.id}|${world.unlocked.supplies.join(',')}`;
    if (pickFor !== pickKey) {
      pickFor = pickKey;
      pick.replaceChildren(...machine.supplies.filter((item) => world.unlocked.supplies.includes(item)).map((item) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.item = item;
        b.append(spriteIcon(bank, rules.items[item].sprite));
        const label = document.createElement('span');
        label.textContent = rules.items[item].name;
        b.append(label);
        b.addEventListener('click', () => setSupplyItem(rules, st, item, world));
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
        status.textContent = st.hist !== undefined || ['splitter', 'merger', 'farm'].includes(machine.kind)
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
        if (world.power.ratio < 1 && rules.machines[st.type].power) parts.push(`전력 부족: ${Math.round(world.power.ratio * 100)}% 속도`);
        if (st.contents?.length) parts.push(`입력: ${countList(rules, st.contents)}`);
        if (st.output?.length) parts.push(`출력: ${countList(rules, st.output)}`);
        if (st.held) parts.push(`집게: ${rules.items[st.held].name}`);
        if (st.packs) {
          for (const [id, pack] of Object.entries(st.packs)) {
            const counts = Object.entries(pack).flatMap(([item, n]) => Array(n).fill(item));
            parts.push(`주문 #${id}: ${countList(rules, counts)}`);
          }
          if (st.out.length) parts.push(`내보낼 것 ${st.out.length}개`);
        }
        buffers.textContent = parts.join(' / ');
      }
      renderSupplyPick(st);
      storageBox.hidden = true;
      gateBox.hidden = true;
      if (machine.kind === 'storage') renderStorage(st);
      if (machine.kind === 'gate') renderGate(st);
    },
  };
}
