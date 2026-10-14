// 타이틀 화면: 로고 + 이름 + 시작 버튼 하나. 저장이 있으면 '이어서 하기'와 한 줄 요약.
// 누를 때까지 게임은 멈춰 있다 (첫 입력이라 소리도 여기서 열린다).

export function createTitle({ world, bank, hasSave, onStart }) {
  const box = document.getElementById('title');
  const btn = document.getElementById('btn-title-start');
  const info = document.getElementById('title-info');
  const logo = document.getElementById('title-logo');

  const lctx = logo.getContext('2d');
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(bank.get('logo'), 0, 0);

  btn.textContent = hasSave ? '이어서 하기' : '시작';
  info.hidden = !hasSave;
  if (hasSave) info.textContent = `${world.day?.n ?? 1}일째 · 돈 ${Math.floor(world.money)}`;

  let open = true;
  function start() {
    if (!open) return;
    open = false;
    box.hidden = true;
    onStart();
  }
  btn.addEventListener('click', start);
  box.hidden = false;
  btn.focus({ preventScroll: true });

  return { isOpen: () => open, start };
}
