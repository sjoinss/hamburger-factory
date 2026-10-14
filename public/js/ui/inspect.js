// 선택한 기계 정보: 상태, 최근 60초 가동률, 버퍼, 입고구 품목 설정.
import { stationById } from '../sim/lookup.js';
import { utilization, HISTORY_SECONDS } from '../sim/stats.js';
import { setSupplyItem, setMachineRecipe } from '../sim/station.js';
import { producible } from '../sim/market.js';
import { storageTotal, setStorageFilter } from '../sim/storage.js';
import { setGateManual, gateSources } from '../sim/gate.js';
import { orderById } from '../sim/orders.js';
import { spriteIcon, itemChip } from './icons.js';
import { checkUpgrade, levelOf, upgradable, upgradeStation } from '../sim/upgrade.js';
import { settingsKind, readSettings, applySettings } from '../sim/presets.js';
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
  const upgradeBox = $('upgrade-box');
  const upgradeCost = $('upgrade-cost');
  const upgradeBtn = $('btn-upgrade');
  const UPGRADE_REASON = { max: '최고 등급', money: '돈 부족', parts: '부품 부족' };
  const recipePick = $('recipe-pick');
  const sorterPick = $('sorter-pick');

  /** 만들 것: 해금된 레시피가 둘 이상인 자동 기계만. '자동' = 재료가 먼저 다 찬 것 */
  function renderRecipePick(st) {
    const m = rules.machines[st.type];
    const list = m.kind === 'machine'
      ? rules.recipesByStation[st.type].filter((r) => world.unlocked.recipes.includes(r.id))
      : [];
    recipePick.hidden = list.length < 2;
    if (recipePick.hidden) return;
    const key = `${st.id}|${list.map((r) => r.id).join(',')}`;
    if (recipePick.dataset.key !== key) {
      recipePick.dataset.key = key;
      const make = (r) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.recipe = r?.id ?? '';
        const out = r ? Object.keys(r.outputs)[0] : null;
        if (out) b.append(spriteIcon(bank, rules.items[out].sprite));
        const label = document.createElement('span');
        label.textContent = out ? rules.items[out].name : '자동';
        b.append(label);
        b.addEventListener('click', () => setMachineRecipe(rules, st, r?.id ?? null));
        return b;
      };
      recipePick.replaceChildren(make(null), ...list.map(make));
    }
    for (const b of recipePick.children) b.setAttribute('aria-pressed', String((b.dataset.recipe || null) === (st.recipe ?? null)));
  }

  /** 선별기: 왼쪽으로 뺄 품목. 지금 만들 수 있거나 들여올 수 있는 것 중에서 */
  function renderSorterPick(st) {
    sorterPick.hidden = rules.machines[st.type].kind !== 'sorter';
    if (sorterPick.hidden) return;
    const ids = new Set([...producible(world, rules), ...world.unlocked.supplies]);
    for (const type of world.unlocked.machines) if (rules.machines[type].kind === 'farm') ids.add(rules.machines[type].crop);
    const list = Object.keys(rules.items).filter((id) => ids.has(id) && rules.items[id].category !== 'bundle');
    itemButtons(sorterPick, list, st.filter, (id) => { st.filter = id; }, '정하지 않음');
  }
  const presetBox = $('preset-box');
  const copyBtn = $('btn-preset-copy');
  const pasteBtn = $('btn-preset-paste');
  // 설정 복사: 같은 종류(입고구끼리, 저장소끼리, 게이트끼리)에 붙인다
  let clip = null;
  const selStation = () => (selectedId === null ? null : stationById(world, selectedId));

  copyBtn.addEventListener('click', () => {
    const st = selStation();
    if (!st) return;
    clip = { kind: settingsKind(rules, st.type), settings: readSettings(rules, st), from: st.id };
    copyBtn.textContent = '복사함';
  });
  pasteBtn.addEventListener('click', () => {
    const st = selStation();
    if (st && clip) pasteBtn.textContent = applySettings(world, rules, st, clip.settings) ? '붙임' : '붙일 수 없음';
  });

  function renderPreset(st) {
    const kind = settingsKind(rules, st.type);
    presetBox.hidden = !kind;
    if (!kind) return;
    const key = `${st.id}|${clip?.from ?? ''}`;
    if (presetBox.dataset.key === key) return;
    presetBox.dataset.key = key;
    copyBtn.textContent = clip?.from === st.id ? '복사함' : '설정 복사';
    pasteBtn.textContent = '설정 붙이기';
    pasteBtn.hidden = !clip || clip.kind !== kind || clip.from === st.id;
  }

  upgradeBtn.addEventListener('click', () => {
    const st = selectedId === null ? null : stationById(world, selectedId);
    if (st) upgradeStation(world, rules, st);
  });

  /** 업그레이드: 다음 등급 비용 + 버튼 (부족한 것은 표시) */
  function renderUpgrade(st) {
    upgradeBox.hidden = !world.features.includes('upgrades') || !upgradable(rules, st);
    if (upgradeBox.hidden) return;
    const check = checkUpgrade(world, rules, st);
    const key = JSON.stringify([st.id, levelOf(st), check.reason ?? 'ok', check.missing ?? null]);
    if (upgradeBox.dataset.key === key) return;
    upgradeBox.dataset.key = key;
    upgradeCost.replaceChildren();
    if (check.cost) {
      const money = document.createElement('span');
      money.textContent = `돈 ${check.cost.money}`;
      if (check.reason === 'money') money.classList.add('is-short');
      upgradeCost.append(money);
      for (const [id, n] of Object.entries(check.cost.parts)) {
        const c = itemChip(bank, rules, id, check.missing?.[id] ? `${n} · 부족 -${check.missing[id]}` : String(n));
        if (check.missing?.[id]) c.classList.add('is-short');
        upgradeCost.append(c);
      }
    }
    const pctUp = Math.round(rules.game.upgrades.speedPerLevel * 100);
    upgradeBtn.textContent = check.ok ? `업그레이드 (속도 +${pctUp}%)` : UPGRADE_REASON[check.reason] ?? '업그레이드 불가';
    upgradeBtn.disabled = !check.ok;
  }

  /** 고를 수 있는 품목: 파는 물건 + (있으면) 저장소에 든 물건 */
  const choosable = (extra = []) => {
    const ids = new Set(Object.keys(rules.items).filter((id) => rules.items[id].price > 0));
    for (const id of extra) ids.add(id); // 저장소에 든 원료·부품도 고를 수 있다
    return [...ids];
  };

  /** 아이콘 버튼 줄 (같은 목록이면 다시 만들지 않고 눌림 상태만 바꾼다). withAll: '전체' 버튼 (글자를 주면 그 글자로) */
  function itemButtons(row, ids, current, onPick, withAll = false) {
    const allLabel = typeof withAll === 'string' ? withAll : '전체';
    const key = (withAll ? `${allLabel}|` : '') + ids.join(',');
    if (row.dataset.key !== key) {
      row.dataset.key = key;
      const make = (id) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.item = id ?? '';
        if (id) b.append(spriteIcon(bank, rules.items[id].sprite));
        const label = document.createElement('span');
        label.textContent = id ? rules.items[id].name : allLabel;
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
      name.textContent = levelOf(st) > 0 ? `${machine.name} Lv${levelOf(st)}` : machine.name;

      if (machine.kind === 'belt') {
        const state = st.jam > 0.5 ? '막힘 (꽉 차서 멈춤)' : st.idle > 0.8 ? '한산 (비어 있음)' : '흐르는 중';
        status.textContent = `${state} · 위에 ${st.items.length}개`;
        util.textContent = '';
        bars.forEach((b) => b.style.setProperty('--w', '0%'));
        buffers.textContent = '';
      } else {
        status.textContent = st.hist !== undefined || ['splitter', 'merger', 'sorter', 'farm'].includes(machine.kind)
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
      renderUpgrade(st);
      renderRecipePick(st);
      renderSorterPick(st);
      renderPreset(st);
      storageBox.hidden = true;
      gateBox.hidden = true;
      if (machine.kind === 'storage') renderStorage(st);
      if (machine.kind === 'gate') renderGate(st);
    },
  };
}
