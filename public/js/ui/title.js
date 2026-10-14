// 타이틀 화면: 처음 시작할 때만 (이어서 할 때는 건너뛴다). 로고 + 이름 + 시작 버튼 하나.
// 누를 때까지 게임은 멈춰 있다 (첫 입력이라 소리도 여기서 열린다).

export function createTitle({ bank, onStart }) {
  const box = document.getElementById('title');
  const btn = document.getElementById('btn-title-start');
  const logo = document.getElementById('title-logo');

  const lctx = logo.getContext('2d');
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(bank.get('logo'), 0, 0);

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
