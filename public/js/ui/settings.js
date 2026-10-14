// 설정 패널: 저장(자동 30초 + 지금 저장), 파일 내보내기/불러오기, 새로 시작, 소리.
// localStorage 는 막혀 있을 수 있으므로 모든 읽기/쓰기는 try/catch.
import { serializeWorld, loadWorld, SAVE_MAX_CHARS } from '../sim/save.js';

const SAVE_KEY = 'hamburger-factory:save';
// 불러오지 못한 저장은 지우지 않고 여기로 옮겨 둔다 (나중에 살펴볼 수 있게)
const BROKEN_KEY = 'hamburger-factory:save-broken';
const AUTOSAVE_MS = 30_000;
const CONFIRM_MS = 3000;

/**
 * 부팅할 때 저장된 게임을 읽는다.
 * @returns {{ world?, dropped?, error? }} 저장이 없으면 빈 객체
 */
export function readSavedGame(rules) {
  let text = null;
  try {
    text = localStorage.getItem(SAVE_KEY);
  } catch {
    return { error: '이 브라우저에서는 저장을 쓸 수 없다' };
  }
  if (!text) return {};
  try {
    return loadWorld(rules, text);
  } catch (err) {
    try {
      localStorage.setItem(BROKEN_KEY, text);
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* 옮기지 못해도 새 게임은 시작한다 */
    }
    return { error: `저장을 불러오지 못해 새로 시작: ${err.message}` };
  }
}

const clock = (d) => d.toTimeString().slice(0, 8);

export function createSettings({ world, rules, sound, onReplace, banner }) {
  const $ = (id) => document.getElementById(id);
  const status = $('save-status');
  const fileInput = $('import-file');
  const newBtn = $('btn-new');
  const muteBtn = $('btn-mute');
  const sliders = { master: $('vol-master'), sfx: $('vol-sfx') };
  let confirmUntil = 0;

  function saveNow() {
    try {
      localStorage.setItem(SAVE_KEY, serializeWorld(world, Date.now()));
      status.textContent = `저장함 ${clock(new Date())}`;
      return true;
    } catch {
      status.textContent = '저장 실패: 브라우저 저장 공간을 쓸 수 없다';
      return false;
    }
  }

  setInterval(saveNow, AUTOSAVE_MS);
  // 탭을 닫거나 숨길 때도 저장
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  $('btn-save').addEventListener('click', () => {
    if (saveNow()) banner('저장했다', 1.5);
  });

  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([serializeWorld(world)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${clock(d).replaceAll(':', '')}`;
    a.href = url;
    a.download = `hamburger-factory-${stamp}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = '파일로 내보냈다';
  });

  $('btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > SAVE_MAX_CHARS) {
      status.textContent = '불러오기 실패: 파일이 너무 크다';
      return;
    }
    try {
      const res = loadWorld(rules, await file.text());
      onReplace(res.world);
      saveNow();
      banner(res.dropped ? `불러옴 (자리가 맞지 않는 기계 ${res.dropped}개는 뺐다)` : '불러왔다', 2.5);
    } catch (err) {
      status.textContent = `불러오기 실패: ${err.message}`;
    }
  });

  // 새로 시작: 실수로 누르지 않게 3초 안에 한 번 더 눌러야 한다 (브라우저 확인창은 쓰지 않는다)
  newBtn.addEventListener('click', () => {
    const now = performance.now();
    if (now > confirmUntil) {
      confirmUntil = now + CONFIRM_MS;
      newBtn.textContent = '한 번 더 누르면 새로';
      setTimeout(() => { newBtn.textContent = '새로 시작'; }, CONFIRM_MS);
      return;
    }
    confirmUntil = 0;
    newBtn.textContent = '새로 시작';
    onReplace(null);
    saveNow();
    banner('새 공장을 시작했다', 2);
  });

  // ── 소리 ──
  function renderSound() {
    const s = sound.settings();
    muteBtn.setAttribute('aria-pressed', String(s.muted));
    muteBtn.textContent = s.muted ? '음소거 중 (누르면 켜기)' : '음소거';
    for (const [k, el] of Object.entries(sliders)) {
      el.value = String(Math.round(s[k] * 100));
      $(`vol-${k}-out`).textContent = el.value;
    }
  }
  muteBtn.addEventListener('click', () => {
    sound.set({ muted: !sound.settings().muted });
    renderSound();
  });
  for (const [k, el] of Object.entries(sliders)) {
    el.addEventListener('input', () => {
      sound.set({ [k]: Number(el.value) / 100 });
      renderSound();
    });
  }
  renderSound();

  return { saveNow, setStatus: (text) => { status.textContent = text; } };
}
