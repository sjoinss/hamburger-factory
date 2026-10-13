// 건설 모드: 기계 고르기 → 칸 고르기(마우스/방향키/탭) → 설치. 철거 모드도 같은 커서를 쓴다.
// 청사진: 영역 고르기(끌기, 또는 모서리 두 번 확정) → 이름 → 목록에서 붙여넣기.
import { checkPlacement, placeMachine, removeMachine, removableAt, missingParts, rotateStation } from '../sim/build.js';
import { stationAt } from '../sim/lookup.js';
import { partCount } from '../sim/parts.js';
import { checkZone, buyZone } from '../sim/zones.js';
import { inBounds } from '../sim/grid.js';
import { spriteIcon, itemChip } from './icons.js';
import { captureBlueprint, checkBlueprint, pasteBlueprint, rotateBlueprint } from '../sim/blueprint.js';
import { createBlueprints } from './blueprints.js';

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
    draw: document.getElementById('btn-build-draw'),
  };
  // 터치: 끌기를 '벨트 깔기'로 쓸지 '화면 이동'으로 쓸지 (끌어서 깔 수 있는 기계일 때만 의미 있음)
  let drawEnabled = true;
  const drawLabel = () => {
    if (!drawEnabled) return '끌면 화면 이동';
    return mode?.kind === 'select' ? '끌어서 고르기' : '끌어서 깔기';
  };
  bar.draw.addEventListener('click', () => {
    drawEnabled = !drawEnabled;
    bar.draw.setAttribute('aria-pressed', String(drawEnabled));
    bar.draw.textContent = drawLabel();
  });

  // { kind: 'place', type, rot } | { kind: 'remove' } | { kind: 'select', a } | { kind: 'paste', bp }
  let mode = null;
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
    bar.rotate.hidden = mode?.kind !== 'place' && mode?.kind !== 'paste';
    bar.draw.hidden = !((mode?.kind === 'place' && rules.machines[mode.type].dragPlace) || mode?.kind === 'select');
    bar.draw.textContent = drawLabel();
    updateConfirmLabel();
    onModeChange?.(mode);
  }

  function updateConfirmLabel() {
    const labels = { remove: '철거', paste: '붙여넣기', select: mode?.a ? '여기까지 저장' : '시작점' };
    bar.confirm.textContent = labels[mode?.kind] ?? '설치';
  }

  function preview() {
    if (!mode) return null;
    if (mode.kind === 'select') {
      const a = mode.a ?? cursor;
      const x = Math.min(a.x, cursor.x);
      const y = Math.min(a.y, cursor.y);
      return { kind: 'select', x, y, w: Math.abs(a.x - cursor.x) + 1, h: Math.abs(a.y - cursor.y) + 1, ok: true };
    }
    if (mode.kind === 'paste') {
      const check = checkBlueprint(world, rules, mode.bp, cursor.x, cursor.y);
      return { kind: 'paste', bp: mode.bp, x: cursor.x, y: cursor.y, w: mode.bp.w, h: mode.bp.h, ...check, badSet: new Set(check.bad) };
    }
    if (mode.kind === 'place') {
      const check = checkPlacement(world, rules, mode.type, cursor.x, cursor.y, mode.rot);
      return { kind: 'place', type: mode.type, rot: mode.rot, x: cursor.x, y: cursor.y, ...check };
    }
    const st = removableAt(world, cursor.x, cursor.y);
    if (st) return { kind: 'remove', x: st.x, y: st.y, w: st.w, h: st.h, ok: true, station: st };
    return { kind: 'remove', x: cursor.x, y: cursor.y, w: 1, h: 1, ok: false };
  }

  /** 고른 두 모서리 안의 지은 기계로 청사진을 만들고 이름을 묻는다 */
  function finishSelect(a, b) {
    const bp = captureBlueprint(world, rules, a.x, a.y, b.x, b.y);
    if (!bp) {
      flash('고른 영역에 통째로 들어온 지은 기계가 없다');
      mode.a = null;
      updateConfirmLabel();
      return;
    }
    setMode(null);
    blueprints.askName(bp);
  }

  function confirm() {
    if (!mode) return;
    if (mode.kind === 'select') {
      if (!mode.a) {
        mode.a = { ...cursor };
        updateConfirmLabel();
      } else finishSelect(mode.a, cursor);
      return;
    }
    if (mode.kind === 'paste') {
      const res = pasteBlueprint(world, rules, mode.bp, cursor.x, cursor.y);
      if (res.ok) {
        flash(`청사진 '${mode.bp.name}': 기계 ${mode.bp.entries.length}개 설치`);
        renderPanel();
      } else flash(pasteFailText(res));
      return;
    }
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

  function pasteFailText(check) {
    if (check.reason === 'parts') return placeFailText(check);
    if (check.reason === 'locked') return '아직 잠긴 기계가 들어 있다';
    return `놓을 수 없는 자리 (${check.bad.length}개 겹침)`;
  }

  function placeFailText(check) {
    if (check.reason === 'parts') {
      return `부품 부족: ${Object.entries(check.missing).map(([id, n]) => `${partName(id)} -${n}`).join(', ')}`;
    }
    return PLACE_REASON[check.reason] ?? '지을 수 없다';
  }

  // ── 건설 패널 ──
  const chip = (id, text) => itemChip(bank, rules, id, text);

  function renderPanel() {
    const partIds = Object.keys(rules.items).filter((id) => rules.items[id].category === 'part');
    // 받은 부품 + 호퍼·사일로에 쌓인 부품 (건설에 바로 쓰인다)
    partsList.replaceChildren(...partIds.map((id) => chip(id, `${partName(id)} ${partCount(world, rules, id)}`)));
    renderZones();
    blueprints.render();

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

  const zoneBox = document.getElementById('zone-box');
  const zoneList = document.getElementById('zone-list');
  const ZONE_REASON = { owned: '매입 완료', requires: '앞 구역부터', money: '돈 부족', parts: '부품 부족' };
  function renderZones() {
    zoneBox.hidden = !world.features.includes('zones');
    if (zoneBox.hidden) return;
    zoneList.replaceChildren(...rules.zones.zones.map((z) => {
      const check = checkZone(world, rules, z.id);
      const li = document.createElement('li');
      li.className = 'zone';
      const name = document.createElement('span');
      name.className = 'zone-name';
      name.textContent = `${z.name} · ${z.trait.text}`;
      const cost = document.createElement('span');
      cost.className = 'zone-cost';
      const money = document.createElement('span');
      money.textContent = `돈 ${z.cost.money}`;
      if (check.reason === 'money') money.classList.add('is-short');
      cost.append(money);
      for (const [id, n] of Object.entries(z.cost.parts)) {
        const c = chip(id, check.missing?.[id] ? `${n} · 부족 -${check.missing[id]}` : String(n));
        if (check.missing?.[id]) c.classList.add('is-short');
        cost.append(c);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = check.ok ? '매입' : ZONE_REASON[check.reason] ?? '매입 불가';
      btn.disabled = !check.ok;
      btn.addEventListener('click', () => {
        const res = buyZone(world, rules, z.id);
        flash(res.ok ? `${z.name} 매입: ${z.trait.text}` : ZONE_REASON[res.reason] ?? '매입 불가');
        renderPanel();
      });
      li.append(name, cost, btn);
      return li;
    }));
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
  function startSelect() {
    panels.close();
    Object.assign(cursor, startCursor());
    setMode({ kind: 'select', a: null });
  }
  function startPaste(bp) {
    panels.close();
    Object.assign(cursor, startCursor());
    setMode({ kind: 'paste', bp });
  }
  const blueprints = createBlueprints({ world, rules, bank, onPaste: startPaste, onCapture: startSelect, flash });

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
    // 청사진은 통째로 돈다. 가운데를 축으로 돌려서 화면 밖(모바일은 아래 조작 띠 뒤)으로 밀려나지 않게
    if (mode?.kind === 'paste') {
      const { w, h } = mode.bp;
      mode.bp = rotateBlueprint(rules, mode.bp);
      // trunc: 네 번 돌리면 커서가 제자리로 (floor 면 두 번마다 한 칸씩 밀린다)
      const x = Math.max(0, cursor.x + Math.trunc((w - h) / 2));
      const y = Math.max(0, cursor.y + Math.trunc((h - w) / 2));
      if (inBounds(world.grid, x, y)) Object.assign(cursor, { x, y });
    }
  }

  let drag = null; // { x, y, id } 마지막으로 끌어서 놓은 칸
  let selecting = false; // 청사진 영역을 끄는 중

  return {
    active: () => mode !== null,
    /** 터치 한 손가락 끌기를 벨트 깔기로 쓸지 */
    touchDraws: () => drawEnabled && ((mode?.kind === 'place' && Boolean(rules.machines[mode.type].dragPlace)) || mode?.kind === 'select'),
    /** 마우스를 누른 칸: 설치(또는 철거)하고, 끌기 시작 */
    pressAt(x, y) {
      this.setCursor(x, y);
      drag = null;
      if (mode?.kind === 'select') {
        // 누른 칸이 시작점, 끌고 떼면 그 칸까지 (끌지 않고 떼면 시작점만 정해 둔다)
        mode.a = { ...cursor };
        selecting = true;
        updateConfirmLabel();
        return;
      }
      const before = world.stations.length;
      confirm();
      if (mode?.kind === 'place' && world.stations.length > before) {
        drag = { x, y, id: world.stations[world.stations.length - 1].id };
      }
    },
    /** 누른 채 다른 칸으로: 끌어서 깔 수 있는 기계만 이어서 설치 */
    dragTo(x, y) {
      if (mode?.kind === 'select') {
        if (selecting) this.setCursor(x, y);
        return;
      }
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
    endDrag() {
      drag = null;
      if (!selecting) return;
      selecting = false;
      if (mode?.kind === 'select' && mode.a && (mode.a.x !== cursor.x || mode.a.y !== cursor.y)) finishSelect(mode.a, cursor);
    },
    /** 이름 묻는 창이 열려 있는가 (그동안 게임 단축키 무시) */
    naming: () => !document.getElementById('bp-name-box').hidden,
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
      if (p.kind === 'select') {
        if (!mode.a) return { text: touch ? '청사진: 영역을 끌거나, 모서리를 탭하고 시작점' : '청사진: 영역을 끌어서 고르기 (또는 Enter 로 두 모서리)' };
        return { text: `청사진: ${p.w}×${p.h} 영역 · ${touch ? '여기까지 저장' : '끌기를 놓거나 Enter'}` };
      }
      if (p.kind === 'paste') {
        if (!p.ok) return { text: `${p.bp.name}: ${pasteFailText(p)}`, blocked: true };
        return { text: `${p.bp.name}: ${touch ? '칸을 탭하고 붙여넣기 · 회전' : '클릭/Enter 로 붙여넣기 · R 회전 · Esc 끝'}` };
      }
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
