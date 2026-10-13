// 상단 바, 손, 작업 안내, 정보 패널 갱신. 문자열은 textContent 로만 넣는다.
import { spriteIcon } from './icons.js';
import { machineRecipe, farmGrowth } from '../sim/station.js';
import { marketPrice } from '../sim/market.js';
import { anyOrderNeeds } from '../sim/orders.js';
import { storageTotal } from '../sim/storage.js';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const itemName = (rules, id) => rules.items[id]?.name ?? id;
const listNames = (rules, counts) =>
  Object.entries(counts).map(([id, n]) => (n > 1 ? `${itemName(rules, id)}×${n}` : itemName(rules, id))).join(' + ');

/** 자동 기계 상태 한 줄: "가동 중 45%" / "대기: 다진고기 넣기" / "막힘: 출력 꽉 참" */
export function machineStatusText(station, rules, world = null) {
  const name = (id) => itemName(rules, id);
  const kind = rules.machines[station.type].kind;
  if (kind === 'inserter') {
    if (station.status === 'running') return `옮기는 중${station.held ? `: ${name(station.held)}` : ''}`;
    if (station.status === 'blocked') return '막힘: 앞 칸이 받지 않음';
    return '대기: 뒤 칸에 앞으로 보낼 물건 없음';
  }
  if (kind === 'supply') {
    if (station.status === 'blocked') return `막힘: 출력 꽉 참 (${name(station.item)})`;
    const m = rules.machines[station.type];
    return `들여오는 중: ${name(station.item)} ${Math.floor((station.progress / m.seconds) * 100)}%`;
  }
  if (kind === 'gate') {
    if (station.status === 'running') return '출고 중';
    return {
      unset: '대기: 내보낼 품목을 정하지 않음',
      done: '대기: 다 보냄',
      'no-stock': '대기: 붙은 호퍼/사일로에 재고 없음',
      'no-source': '대기: 옆에 호퍼/사일로가 없음',
      blocked: '막힘: 앞 칸이 받지 않음',
    }[station.reason] ?? '대기';
  }
  if (kind === 'reader') {
    return {
      'no-gate': '대기: 옆에 출고 게이트가 없음',
      'no-order': '대기: 들어온 주문 없음',
      'no-stock': '대기: 재고가 모자라 맡길 주문이 없음',
      busy: '게이트가 출고 중',
      assigned: `주문 #${station.last} 을 게이트에 맡김`,
    }[station.reason] ?? '대기';
  }
  if (kind === 'bundler') {
    const packs = Object.keys(station.packs).length;
    if (station.status === 'blocked') return '막힘: 앞 칸이 받지 않음';
    if (packs > 0) return `주문 ${packs}건 모으는 중`;
    return station.status === 'running' ? '내보내는 중' : '대기: 번호표 붙은 물건 기다림';
  }
  if (kind === 'storage') return `${storageTotal(station)} / ${rules.machines[station.type].capacity}`;
  if (kind === 'generator') {
    const m = rules.machines[station.type];
    const fuel = station.contents.length;
    if (station.status === 'running') return `발전 중 ${m.output}kW · ${name(m.fuel)} ${fuel}개 남음`;
    return `대기: ${name(m.fuel)} 넣기 (최대 ${m.fuelCap}개)`;
  }
  if (kind === 'farm') {
    const crop = name(rules.machines[station.type].crop);
    if (station.output.length > 0) return `다 자람: ${crop} ${station.output.length}개 수확 가능`;
    return `자라는 중 ${Math.floor(farmGrowth(rules, station) * 100)}%`;
  }
  if (kind === 'splitter') return '좌우로 번갈아 나눔';
  if (kind === 'merger') return '모아서 앞으로';
  if (station.status === 'running') {
    const r = machineRecipe(rules, station);
    return `가동 중 ${r ? Math.floor((station.progress / r.seconds) * 100) : 0}%`;
  }
  if (station.status === 'blocked') return '막힘: 출력 꽉 참';
  const inputs = new Set(rules.recipesByStation[station.type].flatMap((r) => Object.keys(r.inputs)));
  return `대기: ${[...inputs].map(name).join(', ')} 넣기`;
}

/** 지금 할 수 있는 작업을 한 줄 안내로. 색 대신 글로 상태를 알려 준다. */
export function describeInteraction(act, rules, touch, world = null) {
  const key = touch ? '작업' : 'E';
  const dropKey = touch ? '내려놓기' : 'Q';
  const pct = (r) => `${Math.floor(Math.min(1, r) * 100)}%`;
  const name = (id) => itemName(rules, id);

  switch (act.action) {
    case 'take': {
      if (act.machine.kind !== 'machine') return { text: `${key}: ${name(act.item)} 꺼내기` };
      const n = act.station.output.length;
      return { text: `${key}: ${name(act.item)} 꺼내기${n > 1 ? ` (${n}개)` : ''} · ${machineStatusText(act.station, rules)}` };
    }
    case 'deposit': {
      const verb = act.machine.kind === 'machine' || act.machine.kind === 'generator' ? '넣기' : '올리기';
      return { text: `${key}: ${name(act.item)} → ${act.machine.name}에 ${verb}` };
    }
    case 'sell':
      if (world && anyOrderNeeds(world, act.item)) return { text: `${key}: ${name(act.item)} 주문에 넣기` };
      return { text: `${key}: ${name(act.item)} 판매 (+${world ? marketPrice(world, rules, act.item) : rules.items[act.item].price})` };
    case 'store': return { text: `${key}: ${name(act.item)} → ${act.machine.name}에 넣기` };
    case 'unstore': return { text: `${key}: ${act.machine.name}에서 ${name(act.item)} 꺼내기` };
    case 'pickup': return { text: `${key}: ${name(act.item)} 줍기` };
    case 'belt-take': return { text: `${key}: 벨트에서 ${name(act.item)} 집기${act.count > 1 ? ` (${act.count}개)` : ''}` };
    case 'belt-put': return { text: `${key}: ${name(act.item)} 벨트에 올리기` };
    case 'gather': return { text: `${key} 길게: ${name(act.item)} 꺼내기 ${pct(act.progress)}` };
    case 'harvest': return { text: `${key} 길게: ${name(act.item)} 수확 ${pct(act.progress)} (남은 ${act.left}개)` };
    case 'work':
      return {
        text: `${key} 길게: ${act.recipe.verb} ${pct(act.progress)} · ${listNames(rules, act.recipe.inputs)} → ${listNames(rules, act.recipe.outputs)}`,
      };
    case 'blocked': {
      const where = act.machine ? `${act.machine.name}: ` : '';
      if (act.reason === 'full') return { blocked: true, text: `${where}손이 꽉 찼다 (${dropKey})` };
      if (act.reason === 'belt-busy') return { blocked: true, text: `${where}벨트 가운데가 차 있다` };
      if (act.reason === 'belt-empty') return { blocked: true, text: '' };
      if (act.reason === 'bag') return { blocked: true, text: `${where}주문 묶음은 손으로 집지 않는다` };
      if (act.reason === 'storage-empty') return { blocked: true, text: `${where}비어 있다` };
      if (act.reason === 'growing') return { blocked: true, text: `${where}자라는 중 ${pct(act.progress)}` };
      if (act.reason === 'status') return { text: `${where}${machineStatusText(act.station, rules, world)}` };
      if (act.reason === 'unsellable') return { blocked: true, text: `${where}지금 든 물건은 팔 수 없다` };
      if (act.reason === 'empty-hands') return { blocked: true, text: `${where}팔 물건을 들고 오기` };
      if (act.reason === 'needs') {
        if (act.missing.length > 0) return { blocked: true, text: `${where}${act.missing.map(name).join(', ')} 필요` };
        const accepts = new Set(rules.recipesByStation[act.station.type].flatMap((r) => Object.keys(r.inputs)));
        return { blocked: true, text: `${where}${[...accepts].map(name).join(', ')}을(를) 올릴 수 있다` };
      }
      return { blocked: true, text: '' };
    }
    default:
      return { text: '' };
  }
}

export function createHud({ onSpeed, bank, rules }) {
  const $ = (id) => document.getElementById(id);
  const money = $('stat-money');
  const rep = $('stat-rep');
  const time = $('stat-time');
  const powerBox = $('stat-power-box');
  const powerEl = $('stat-power');
  const prompt = $('prompt');
  const handsList = $('hands-slots');
  const handsBox = handsList.parentElement;
  const speedButtons = [...document.querySelectorAll('.speed button[data-speed]')];

  for (const btn of speedButtons) {
    btn.addEventListener('click', () => onSpeed(Number(btn.dataset.speed)));
  }
  // 상단 바 높이가 바뀌면 (좁은 화면에서 두 줄) 오버레이 위치도 따라간다.
  const topbar = document.querySelector('.topbar');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--top-h', `${Math.ceil(topbar.getBoundingClientRect().height)}px`);
  }).observe(topbar);

  // 손 슬롯: 아이템 스프라이트를 그대로 아이콘으로 쓴다.
  const slots = [];
  function ensureSlots(n) {
    while (slots.length < n) {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'name';
      li.append(label);
      handsList.append(li);
      slots.push({ li, label, item: undefined });
    }
  }

  const last = { money: null, rep: null, time: null, prompt: null };
  let bannerTimer = 0;

  return {
    setSpeed(speed) {
      for (const btn of speedButtons) {
        btn.setAttribute('aria-pressed', String(Number(btn.dataset.speed) === speed));
      }
    },
    update(world, extra) {
      if (last.money !== world.money) money.textContent = String(last.money = world.money);
      if (last.rep !== world.reputation) rep.textContent = String(last.rep = world.reputation);
      // 전력: 쓰는 양 / 공급량. 모자라면 글로도 알린다
      if (world.features.includes('power')) {
        powerBox.hidden = false;
        const p = world.power;
        const text = p.ratio < 1
          ? `${Math.round(p.demand)}/${Math.round(p.supply)}kW 부족 ${Math.round(p.ratio * 100)}%`
          : `${Math.round(p.demand)}/${Math.round(p.supply)}kW`;
        if (powerEl.textContent !== text) powerEl.textContent = text;
        powerEl.classList.toggle('is-short', p.ratio < 1);
      }
      const t = formatTime(world.time);
      if (last.time !== t) time.textContent = last.time = t;

      const inv = world.player.inventory;
      ensureSlots(inv.length);
      // 빈손이면 화면을 가리지 않도록 숨긴다.
      const empty = inv.every((it) => it === null);
      if (handsBox.hidden !== empty) handsBox.hidden = empty;
      inv.forEach((item, i) => {
        const slot = slots[i];
        if (slot.item === item) return;
        slot.item = item;
        slot.li.querySelector('canvas')?.remove();
        if (item) slot.li.prepend(spriteIcon(bank, rules.items[item].sprite));
        slot.label.textContent = item ? itemName(rules, item) : '';
        slot.li.setAttribute('aria-label', `${i + 1}번 손: ${item ? itemName(rules, item) : '비어 있음'}`);
      });

      const d = extra.buildPrompt ?? describeInteraction(extra.interaction, rules, extra.touch, world);
      if (last.prompt !== d.text) {
        prompt.textContent = last.prompt = d.text;
        prompt.classList.toggle('is-blocked', Boolean(d.blocked));
      }

    },
    /** 화면 가운데 위에 잠깐 띄우는 알림 */
    banner(text, seconds = 4) {
      const el = $('banner');
      el.textContent = text;
      el.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { el.hidden = true; }, seconds * 1000);
    },
    flashMoney() {
      money.classList.remove('flash');
      void money.offsetWidth; // 애니메이션 재시작
      money.classList.add('flash');
    },
    setTouchMode(on) {
      document.body.classList.toggle('is-touch', on);
    },
    showMessage(text) {
      const el = $('stage-msg');
      el.textContent = text;
      el.hidden = !text;
    },
    showFontNotice(show) {
      $('font-notice').hidden = !show;
    },
  };
}

/** 픽셀 폰트가 실제로 로드됐는지 확인한다. */
export async function checkPixelFont() {
  try {
    const faces = await document.fonts.load('12px "Galmuri11"');
    return faces.length > 0;
  } catch {
    return false;
  }
}
