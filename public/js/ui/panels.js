// 접이식 패널. 한 번에 하나만 열고, 닫으면 게임 화면으로 포커스를 돌려준다.
// 키보드로 열면 (B, F, 메뉴 버튼에서 Enter/Space) 패널 안 첫 버튼으로 포커스를 옮긴다. 마우스로 열면 그대로.

const FOCUSABLE = 'button:not([data-close]), input:not([type="file"]), select, [tabindex="0"]';

/** 보이는 첫 조작 요소 (내용은 다음 프레임에 그려지는 패널도 있어서 잠깐 뒤에 찾는다) */
function focusInside(panel) {
  setTimeout(() => {
    if (panel.hidden) return;
    const target = [...panel.querySelectorAll(FOCUSABLE)].find((el) => !el.disabled && el.offsetParent !== null)
      ?? panel.querySelector('[data-close]');
    target?.focus({ preventScroll: true });
  }, 60);
}

/** keysBlocked: 단축키를 받지 않을 때 (타이틀 화면) */
export function createPanels({ onOpen, returnFocus, keysBlocked = () => false }) {
  const buttons = new Map();
  for (const btn of document.querySelectorAll('.menu button[data-panel]')) {
    buttons.set(btn.dataset.panel, btn);
  }
  const panelOf = (name) => document.getElementById(`panel-${name}`);
  let current = null;

  function close() {
    if (!current) return;
    panelOf(current).hidden = true;
    buttons.get(current)?.setAttribute('aria-expanded', 'false');
    current = null;
    returnFocus();
  }

  /** opts.focus: 키보드로 열었으면 true */
  function open(name, opts = {}) {
    if (current === name) {
      if (opts.focus) focusInside(panelOf(name));
      return;
    }
    if (current) {
      panelOf(current).hidden = true;
      buttons.get(current)?.setAttribute('aria-expanded', 'false');
    }
    current = name;
    panelOf(name).hidden = false;
    // 메뉴 버튼이 없는 패널도 있다 (기계 정보: 기계를 누르면 열린다)
    buttons.get(name)?.setAttribute('aria-expanded', 'true');
    onOpen?.(name);
    if (opts.focus) focusInside(panelOf(name));
  }

  const toggle = (name, opts) => (current === name ? close() : open(name, opts));

  // detail === 0: 마우스가 아니라 키보드(Enter/Space)로 누른 클릭
  for (const [name, btn] of buttons) btn.addEventListener('click', (e) => toggle(name, { focus: e.detail === 0 }));
  for (const btn of document.querySelectorAll('.panel [data-close]')) btn.addEventListener('click', close);

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    if (keysBlocked()) return;
    if (e.code === 'Escape' && current) {
      e.preventDefault();
      close();
    } else if (e.code === 'KeyB' && !e.repeat) {
      toggle('build', { focus: true });
    }
  });

  return { open, close, toggle, current: () => current };
}
