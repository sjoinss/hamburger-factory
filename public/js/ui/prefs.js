// 기기별 화면 설정: 움직임 줄이기, 진동. 공장 저장과 따로 이 브라우저에만 둔다 (막혀 있으면 기본값).
const KEY = 'hamburger-factory:prefs';

export function createPrefs() {
  // reduceMotion: null = 기기 설정(prefers-reduced-motion)을 따른다
  let prefs = { reduceMotion: null, vibrate: true };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      if (typeof raw.reduceMotion === 'boolean') prefs.reduceMotion = raw.reduceMotion;
      if (typeof raw.vibrate === 'boolean') prefs.vibrate = raw.vibrate;
    }
  } catch {
    /* 기본값 */
  }
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let touch = false;

  const reduced = () => (prefs.reduceMotion === null ? Boolean(media?.matches) : prefs.reduceMotion);
  const apply = () => document.body.classList.toggle('reduce-motion', reduced());
  media?.addEventListener?.('change', apply);
  apply();

  return {
    reducedMotion: reduced,
    canVibrate: () => typeof navigator.vibrate === 'function',
    vibrateOn: () => prefs.vibrate,
    set(patch) {
      prefs = { ...prefs, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(prefs));
      } catch {
        /* 이번 판에서만 */
      }
      apply();
    },
    setTouch(on) { touch = on; },
    /** 터치 화면에서만, 켜 두었을 때만 짧게 떤다 */
    vibrate(pattern) {
      if (!touch || !prefs.vibrate || typeof navigator.vibrate !== 'function') return;
      try {
        navigator.vibrate(pattern);
      } catch {
        /* 지원하지 않는 기기 */
      }
    },
  };
}

/** 사건별 진동 (ms). 없는 사건은 떨지 않는다 */
export const VIBRATE = {
  built: 12,
  crafted: 8,
  orderDone: [20, 40, 20],
  unlocked: 60,
  chapterDone: 60,
  challengeDone: 60,
};
