// 키보드/마우스/터치 입력 수집. 게임 로직은 여기서 꺼낸 순수 값만 받는다.

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'KeyC', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract',
  'KeyR', 'KeyX', 'Enter',
]);
// 누르고 있으면 반복 입력되는 키 (건설 커서 이동)
const REPEAT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
// 이만큼 안 움직이고 뗐으면 끌기가 아니라 클릭/탭
const TAP_SLOP = 8;

// 포인터 캡처 실패는 무시한다 (이미 끝난 포인터 등). 입력 처리는 계속 진행.
function capture(el, pointerId) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* 캡처 없이도 동작한다 */
  }
}

function isTypingTarget(el) {
  return el instanceof HTMLElement &&
    (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/**
 * @param canvas 게임 캔버스
 * @param touchUi {{ joystick, knob, interactBtn, dropBtn }} 터치 조작 요소
 * @param opts {{ deadzone, pinchStep, onTouchMode }}
 */
export function createInput(canvas, touchUi, opts) {
  const down = new Set();
  const pressed = new Set(); // 프레임 단위 단발 입력 (화면 조작)
  // 한 틱 사이에 눌렀다 뗀 짧은 입력도 최소 한 틱은 반영되도록 남겨 둔다.
  const tapped = new Set();
  const mouse = { x: 0, y: 0, inside: false, left: false };
  const presses = []; // 마우스 왼쪽 누름 (건설: 누르는 순간 설치, 끌면 이어서)
  let wheel = 0;
  let dragDX = 0;
  let dragDY = 0;
  let zoomSteps = 0;
  const stick = { x: 0, y: 0, pointerId: null };

  const press = (code) => {
    if (!down.has(code)) {
      pressed.add(code);
      tapped.add(code);
    }
    down.add(code);
  };
  const release = (code) => down.delete(code);

  // ── 키보드 ──
  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    // 버튼에 포커스가 있을 때 Space/Enter 는 버튼 자체 동작에 맡긴다.
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (!e.repeat) press(e.code);
    else if (REPEAT_KEYS.has(e.code)) pressed.add(e.code);
  });
  window.addEventListener('keyup', (e) => release(e.code));
  window.addEventListener('blur', () => {
    down.clear();
    stick.x = stick.y = 0;
  });

  let touchMode = false;
  const noteTouch = (e) => {
    if (e.pointerType === 'touch' && !touchMode) {
      touchMode = true;
      opts.onTouchMode?.(true);
    }
  };

  // ── 캔버스: 마우스 = 우클릭/가운데 끌기, 터치 = 한 손가락 끌기 + 두 손가락 확대 ──
  const pointers = new Map();
  let pinchBase = 0;
  // 클릭/탭 판정용: 누른 위치와 여러 손가락 여부
  const starts = new Map();
  const clicks = [];
  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.inside = true;
    }
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchBase > 0) {
      const d = pinchDistance();
      if (d / pinchBase >= opts.pinchStep) { zoomSteps += 1; pinchBase = d; }
      else if (pinchBase / d >= opts.pinchStep) { zoomSteps -= 1; pinchBase = d; }
    } else if (pointers.size === 1) {
      dragDX += e.clientX - prev.x;
      dragDY += e.clientY - prev.y;
    }
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') mouse.inside = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    noteTouch(e);
    canvas.focus({ preventScroll: true });
    const multi = starts.size > 0;
    if (multi) for (const st of starts.values()) st.multi = true;
    starts.set(e.pointerId, { x: e.clientX, y: e.clientY, multi });
    if (e.pointerType === 'mouse' && e.button === 0) {
      mouse.left = true;
      const r = canvas.getBoundingClientRect();
      presses.push({ x: e.clientX - r.left, y: e.clientY - r.top });
    }
    // 마우스 왼쪽 클릭은 이후 건설용으로 남겨 두고, 마우스 카메라 끌기는 오른쪽/가운데 버튼.
    const isDrag = e.pointerType === 'mouse' ? e.button === 1 || e.button === 2 : true;
    if (!isDrag) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(canvas, e.pointerId);
    if (pointers.size === 2) pinchBase = pinchDistance();
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchBase = 0;
  };
  canvas.addEventListener('pointerup', (e) => {
    const st = starts.get(e.pointerId);
    starts.delete(e.pointerId);
    endPointer(e);
    if (!st || st.multi || Math.hypot(e.clientX - st.x, e.clientY - st.y) > TAP_SLOP) return;
    const r = canvas.getBoundingClientRect();
    clicks.push({
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      button: e.pointerType === 'mouse' ? e.button : 0,
      touch: e.pointerType !== 'mouse',
    });
  });
  canvas.addEventListener('pointercancel', (e) => starts.delete(e.pointerId));
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) mouse.left = false;
  });
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheel += Math.sign(e.deltaY);
  }, { passive: false });

  // ── 터치: 가상 조이스틱 ──
  const { joystick, knob, interactBtn, dropBtn } = touchUi;
  const updateStick = (e) => {
    const r = joystick.getBoundingClientRect();
    const radius = r.width / 2;
    let x = (e.clientX - (r.left + radius)) / radius;
    let y = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const dead = len < opts.deadzone;
    stick.x = dead ? 0 : x;
    stick.y = dead ? 0 : y;
    knob.style.setProperty('--kx', `${Math.round(x * radius * 0.6)}px`);
    knob.style.setProperty('--ky', `${Math.round(y * radius * 0.6)}px`);
  };
  const resetStick = () => {
    stick.pointerId = null;
    stick.x = stick.y = 0;
    knob.style.setProperty('--kx', '0px');
    knob.style.setProperty('--ky', '0px');
  };
  joystick.addEventListener('pointerdown', (e) => {
    noteTouch(e);
    e.preventDefault();
    stick.pointerId = e.pointerId;
    capture(joystick, e.pointerId);
    updateStick(e);
  });
  joystick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.pointerId) updateStick(e);
  });
  joystick.addEventListener('pointerup', resetStick);
  joystick.addEventListener('pointercancel', resetStick);

  // ── 터치: 길게 누르는 버튼 (키보드 E/Q 와 같은 입력으로 취급) ──
  const bindHoldButton = (btn, code) => {
    btn.addEventListener('pointerdown', (e) => {
      noteTouch(e);
      e.preventDefault();
      capture(btn, e.pointerId);
      btn.setAttribute('aria-pressed', 'true');
      press(code);
    });
    const up = () => {
      btn.setAttribute('aria-pressed', 'false');
      release(code);
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    // 키보드로 버튼을 눌렀을 때 (Enter/Space) 는 한 번 누름으로 처리
    btn.addEventListener('click', (e) => {
      if (e.detail === 0) tapped.add(code);
    });
  };
  bindHoldButton(interactBtn, 'KeyE');
  bindHoldButton(dropBtn, 'KeyQ');

  const held = (code) => down.has(code) || tapped.has(code);
  const axis = (neg, pos) => (held(pos) ? 1 : 0) - (held(neg) ? 1 : 0);

  return {
    mouse,
    isTouchMode: () => touchMode,
    /** 시뮬레이션 한 틱에 넘기는 입력. 틱마다 한 번 호출한다. */
    tickIntent() {
      let moveX = axis('KeyA', 'KeyD');
      let moveY = axis('KeyW', 'KeyS');
      if (stick.x || stick.y) { moveX = stick.x; moveY = stick.y; }
      const intent = {
        moveX,
        moveY,
        interactPressed: tapped.has('KeyE'),
        interactHeld: held('KeyE'),
        dropPressed: tapped.has('KeyQ'),
      };
      tapped.clear();
      return intent;
    },
    panVector: () => ({
      x: (down.has('ArrowRight') ? 1 : 0) - (down.has('ArrowLeft') ? 1 : 0),
      y: (down.has('ArrowDown') ? 1 : 0) - (down.has('ArrowUp') ? 1 : 0),
    }),
    clearTaps() { tapped.clear(); },
    consumePress(code) { return pressed.delete(code); },
    consumeZoom() {
      const z = zoomSteps - Math.sign(wheel) * Math.min(1, Math.abs(wheel));
      wheel = 0;
      zoomSteps = 0;
      return z;
    },
    /** 이번 프레임의 클릭/탭 (캔버스 CSS 픽셀 좌표) */
    consumeClicks() { return clicks.splice(0); },
    consumePresses() { return presses.splice(0); },
    consumeDrag() { const d = { x: dragDX, y: dragDY }; dragDX = 0; dragDY = 0; return d; },
    endFrame() { pressed.clear(); },
  };
}
