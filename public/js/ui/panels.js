// 접이식 패널. 한 번에 하나만 열고, 닫으면 게임 화면으로 포커스를 돌려준다.

export function createPanels({ onOpen, returnFocus }) {
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

  function open(name) {
    if (current === name) return;
    if (current) {
      panelOf(current).hidden = true;
      buttons.get(current)?.setAttribute('aria-expanded', 'false');
    }
    current = name;
    panelOf(name).hidden = false;
    // 메뉴 버튼이 없는 패널도 있다 (기계 정보: 기계를 누르면 열린다)
    buttons.get(name)?.setAttribute('aria-expanded', 'true');
    onOpen?.(name);
  }

  const toggle = (name) => (current === name ? close() : open(name));

  for (const [name, btn] of buttons) btn.addEventListener('click', () => toggle(name));
  for (const btn of document.querySelectorAll('.panel [data-close]')) btn.addEventListener('click', close);

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    if (e.code === 'Escape' && current) {
      e.preventDefault();
      close();
    } else if (e.code === 'KeyB' && !e.repeat) {
      toggle('build');
    }
  });

  return { open, close, toggle, current: () => current };
}
