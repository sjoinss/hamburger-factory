// 건설 모드: 기계 고르기 → 칸 고르기(마우스/방향키/탭) → 설치. 철거 모드도 같은 커서를 쓴다.
import { checkPlacement, placeMachine, removeMachine, removableAt, missingParts, rotateStation } from '../sim/build.js';
import { stationAt } from '../sim/lookup.js';
import { inBounds } from '../sim/grid.js';
import { spriteIcon } from './icons.js';

const MESSAGE_SECONDS = 2.5;

const PLACE_REASON = {
  locked: '아직 잠긴 기계',
  outside: '공장 밖',
  blocked: '놓을 수 없는 자리',
  item: '바닥에 물건이 있다',
  player: '플레이어가 서 있는 칸',
};

export function createBuildMode({ world, rules, bank, panels, onModeChange }) {
  const app = document.getElementById('app');
  const partsList = document.getElementById('parts-list');
  const buildList = document.getElementById('build-list');
  const lockedNote = document.getElementById('build-locked');
  const removeBtn = document.getElementById('btn-remove-mode');
  const bar = {
    rotate: document.getElementById('btn-build-rotate'),
    confirm: document.getElementById('btn-build-confirm'),
    cancel: document.getElementById('btn-build-cancel'),
  };

  let mode = null; // { kind: 'place', type, rot } | { kind: 'remove' }
  const cursor = { x: 0, y: 0 };
  let message = '';
  let messageTimer = 0;

  const partName = (id) => rules.items[id].name;
  const flash = (text) => {
    message = text;
    messageTimer = MESSAGE_SECONDS;
  };

  function setMode(next) {
    mode = next;
    app.classList.toggle('is-building', mode !== null);
    removeBtn.setAttribute('aria-pressed', String(mode?.kind === 'remove'));
    bar.rotate.hidden = mode?.kind !== 'place';
    bar.confirm.textContent = mode?.kind === 'remove' ? '철거' : '설치';
    onModeChange?.(mode);
  }

  function preview() {
    if (!mode) return null;
    if (mode.kind === 'place') {
      const check = checkPlacement(world, rules, mode.type, cursor.x, cursor.y, mode.rot);
      return { kind: 'place', type: mode.type, rot: mode.rot, x: cursor.x, y: cursor.y, ...check };
    }
    const st = removableAt(world, cursor.x, cursor.y);
    if (st) return { kind: 'remove', x: st.x, y: st.y, w: st.w, h: st.h, ok: true, station: st };
    return { kind: 'remove', x: cursor.x, y: cursor.y, w: 1, h: 1, ok: false };
  }

  function confirm() {
    if (!mode) return;
    if (mode.kind === 'place') {
      const res = placeMachine(world, rules, mode.type, cursor.x, cursor.y, mode.rot);
      if (!res.ok) flash(placeFailText(res));
      else renderPanel();
      return;
    }
    const res = removeMachine(world, rules, cursor.x, cursor.y);
    if (res.ok) {
      flash(`${rules.machines[res.station.type].name} 철거: 부품을 돌려받았다`);
      renderPanel();
    } else if (res.reason === 'items') {
      flash(`안에 든 물건 ${res.count}개를 받을 손이 모자라다 (빈손 ${res.free}칸)`);
    } else {
      flash('철거할 수 있는 기계가 없다 (처음 있던 작업대는 철거 불가)');
    }
  }

  function placeFailText(check) {
    if (check.reason === 'parts') {
      return `부품 부족: ${Object.entries(check.missing).map(([id, n]) => `${partName(id)} -${n}`).join(', ')}`;
    }
    return PLACE_REASON[check.reason] ?? '지을 수 없다';
  }

  // ── 건설 패널 ──
  function chip(id, text) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.append(spriteIcon(bank, rules.items[id].sprite));
    const label = document.createElement('span');
    label.textContent = text;
    span.append(label);
    return span;
  }

  function renderPanel() {
    const partIds = Object.keys(rules.items).filter((id) => rules.items[id].category === 'part');
    partsList.replaceChildren(...partIds.map((id) => chip(id, `${partName(id)} ${world.parts[id] ?? 0}`)));

    buildList.replaceChildren();
    for (const type of world.unlocked.machines) {
      const m = rules.machines[type];
      const missing = missingParts(world, rules, type);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'build-item';
      btn.append(spriteIcon(bank, m.sprite));
      const name = document.createElement('span');
      name.className = 'build-name';
      name.textContent = `${m.name} ${m.size[0]}×${m.size[1]}`;
      const cost = document.createElement('span');
      cost.className = 'build-cost';
      for (const [id, n] of Object.entries(m.cost)) {
        cost.append(chip(id, missing[id] ? `${n} · 부족 -${missing[id]}` : String(n)));
      }
      btn.append(name, cost);
      btn.addEventListener('click', () => start(type));
      li.append(btn);
      buildList.append(li);
    }
    const locked = Object.values(rules.machines).filter((m) => m.cost).length - world.unlocked.machines.length;
    lockedNote.hidden = locked <= 0;
    lockedNote.textContent = world.unlocked.machines.length === 0
      ? '아직 지을 수 있는 기계가 없다. 첫 햄버거를 팔면 열린다.'
      : `잠긴 기계 ${locked}개`;
  }

  let startCursor = () => ({ x: 0, y: 0 });

  function start(type) {
    panels.close();
    Object.assign(cursor, startCursor());
    setMode({ kind: 'place', type, rot: 0 });
  }
  function startRemove() {
    panels.close();
    Object.assign(cursor, startCursor());
    setMode({ kind: 'remove' });
  }
  const cancel = () => setMode(null);

  removeBtn.addEventListener('click', () => (mode?.kind === 'remove' ? cancel() : startRemove()));
  bar.rotate.addEventListener('click', () => rotate());
  bar.confirm.addEventListener('click', () => confirm());
  bar.cancel.addEventListener('click', cancel);
  // 패널이 열려 있으면 Esc 는 패널이 먼저 닫는다 (panels.js 가 preventDefault)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && mode && !e.defaultPrevented) {
      e.preventDefault();
      cancel();
    }
  });

  function rotate() {
    if (mode?.kind === 'place') mode.rot = (mode.rot + 1) % 4;
  }

  let drag = null; // { x, y, id } 마지막으로 끌어서 놓은 칸

  return {
    active: () => mode !== null,
    /** 마우스를 누른 칸: 설치(또는 철거)하고, 끌기 시작 */
    pressAt(x, y) {
      this.setCursor(x, y);
      drag = null;
      const before = world.stations.length;
      confirm();
      if (mode?.kind === 'place' && world.stations.length > before) {
        drag = { x, y, id: world.stations[world.stations.length - 1].id };
      }
    },
    /** 누른 채 다른 칸으로: 끌어서 깔 수 있는 기계만 이어서 설치 */
    dragTo(x, y) {
      if (!drag || mode?.kind !== 'place' || !rules.machines[mode.type].dragPlace) return;
      // 마우스가 빨라 칸을 건너뛰면 한 칸씩 채워 간다 (대각선은 ㄱ자로)
      let guard = 64;
      while (drag && (drag.x !== x || drag.y !== y) && guard-- > 0) {
        const dx = x - drag.x;
        const dy = y - drag.y;
        const step = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
        this.dragStep(drag.x + step[0], drag.y + step[1]);
      }
    },
    dragStep(x, y) {
      const dx = x - drag.x;
      const dy = y - drag.y;
      const rot = [[1, 0], [0, 1], [-1, 0], [0, -1]].findIndex(([a, c]) => a === dx && c === dy);
      mode.rot = rot;
      const prev = stationAt(world, drag.x, drag.y);
      if (prev && prev.id === drag.id) rotateStation(world, rules, prev, rot);
      this.setCursor(x, y);
      const res = placeMachine(world, rules, mode.type, x, y, rot);
      if (!res.ok) { flash(placeFailText(res)); drag = null; return; }
      drag = { x, y, id: res.station.id };
      renderPanel();
    },
    endDrag() { drag = null; },
    renderPanel,
    preview,
    /** 처음 커서 위치를 정하는 함수 (보통 플레이어가 바라보는 칸) */
    setStartCursor(fn) { startCursor = fn; },
    setCursor(x, y) {
      if (inBounds(world.grid, x, y)) Object.assign(cursor, { x, y });
    },
    moveCursor(dx, dy) {
      this.setCursor(cursor.x + dx, cursor.y + dy);
    },
    cursor: () => ({ ...cursor }),
    rotate,
    confirm,
    cancel,
    toggleRemove: () => (mode?.kind === 'remove' ? cancel() : startRemove()),
    update(realDt) {
      messageTimer = Math.max(0, messageTimer - realDt);
    },
    /** 건설 중 안내 한 줄 (작업 안내 대신 표시) */
    describe(touch) {
      if (messageTimer > 0) return { text: message, blocked: true };
      const p = preview();
      if (!p) return null;
      if (p.kind === 'remove') {
        if (p.ok) return { text: `${rules.machines[p.station.type].name} 철거: ${touch ? '철거 버튼' : '클릭/Enter'} (부품 돌려받음)` };
        return { text: `철거할 기계 고르기 · ${touch ? '취소 버튼' : 'Esc'}로 끝내기`, blocked: true };
      }
      const name = rules.machines[p.type].name;
      if (!p.ok) return { text: `${name}: ${placeFailText(p)}`, blocked: true };
      const kind = rules.machines[p.type].kind;
      const how = kind === 'inserter' ? ' (뒤에서 집어 화살표 쪽에)' : '';
      if (touch) return { text: `${name}${how}: 칸을 탭하고 설치` };
      const drag = rules.machines[p.type].dragPlace ? '끌어서 여러 칸' : '클릭/Enter';
      return { text: `${name}${how}: ${drag} · R 회전 · Esc 끝` };
    },
  };
}
