// 효과음: 파일 없이 Web Audio API 로 합성한다. 첫 사용자 입력(클릭·키·터치) 뒤에만 AudioContext 를 연다.
// 시뮬레이션 사건(world.events)을 받아 소리로 바꾼다. 같은 소리가 몰리면 솎아 낸다 (4배속에서도 시끄럽지 않게).

const KEY = 'hamburger-factory:sound';
const DEFAULTS = Object.freeze({ muted: false, master: 0.35, sfx: 0.7 });

/** 같은 소리 사이 최소 간격 (초) */
const GAP = { coin: 0.08, sizzle: 0.3, thud: 0.15, click: 0.12, build: 0.06, remove: 0.06, bell: 0.4, warn: 0.6, dingdong: 0.3, fanfare: 1, tape: 0.2, beep: 0.3 };

// 사건 → 소리
const MADE_SOUND = {
  grill: 'sizzle', fryer: 'sizzle', oven: 'sizzle', smelter: 'sizzle',
  press: 'thud', gear_lathe: 'thud', meat_cutter: 'thud', potato_cutter: 'thud',
};

function readSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const vol = (v, d) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
    return { muted: raw.muted === true, master: vol(raw.master, DEFAULTS.master), sfx: vol(raw.sfx, DEFAULTS.sfx) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function createSound() {
  const settings = readSettings();
  let ctx = null;
  let master = null;
  let sfx = null;
  let humGain = null;
  let noise = null;
  const last = {};
  let wasShort = false;

  function store() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* 저장 못 해도 이번 판에는 적용된다 */
    }
  }

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, t, 0.02);
    sfx.gain.setTargetAtTime(settings.sfx, t, 0.02);
  }

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    sfx = ctx.createGain();
    master.gain.value = 0;
    sfx.connect(master);
    master.connect(ctx.destination);
    // 흰 소음 1초 (지글·쿵 소리 재료)
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // 벨트 윙윙: 낮은 톱니파를 저역 통과로 뭉갠다. 크기는 update() 가 정한다.
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 55;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    hum.connect(lp).connect(humGain).connect(sfx);
    hum.start();
    apply();
  }
  // 첫 입력에서 연다 (브라우저 자동 재생 정책)
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, start, { capture: true, passive: true });

  function tone({ freq, to = null, type = 'square', dur = 0.1, vol = 0.1, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function hiss({ dur = 0.2, vol = 0.1, filter = 'bandpass', freq = 3000, q = 0.8, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    coin: () => { tone({ freq: 988, dur: 0.06, vol: 0.08 }); tone({ freq: 1319, dur: 0.14, vol: 0.08, delay: 0.06 }); },
    dingdong: () => { tone({ freq: 784, type: 'sine', dur: 0.4, vol: 0.25 }); tone({ freq: 622, type: 'sine', dur: 0.6, vol: 0.25, delay: 0.28 }); },
    warn: () => { tone({ freq: 220, dur: 0.12, vol: 0.08 }); tone({ freq: 196, dur: 0.16, vol: 0.08, delay: 0.18 }); },
    bell: () => tone({ freq: 1175, type: 'triangle', dur: 0.3, vol: 0.12 }),
    sizzle: () => hiss({ dur: 0.35, vol: 0.06, freq: 4000, q: 0.6 }),
    thud: () => { tone({ freq: 130, to: 45, type: 'sine', dur: 0.2, vol: 0.3 }); hiss({ dur: 0.08, vol: 0.1, filter: 'lowpass', freq: 500 }); },
    click: () => tone({ freq: 660, dur: 0.03, vol: 0.04 }),
    build: () => { tone({ freq: 330, to: 200, type: 'triangle', dur: 0.12, vol: 0.15 }); hiss({ dur: 0.05, vol: 0.06, filter: 'lowpass', freq: 800 }); },
    remove: () => tone({ freq: 200, to: 360, type: 'triangle', dur: 0.12, vol: 0.12 }),
    fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.14, vol: 0.08, delay: i * 0.09 })),
    tape: () => hiss({ dur: 0.14, vol: 0.08, filter: 'highpass', freq: 2500 }),
    beep: () => { tone({ freq: 1500, dur: 0.04, vol: 0.05 }); tone({ freq: 1800, dur: 0.04, vol: 0.05, delay: 0.07 }); },
  };

  function play(name) {
    if (!ctx || ctx.state !== 'running' || settings.muted || settings.master === 0 || settings.sfx === 0) return;
    const now = ctx.currentTime;
    if (now - (last[name] ?? -Infinity) < (GAP[name] ?? 0.05)) return;
    last[name] = now;
    SOUNDS[name]();
  }

  return {
    settings: () => ({ ...settings }),
    set(patch) {
      Object.assign(settings, patch);
      store();
      apply();
    },
    /** 시뮬레이션 사건 하나 */
    event(ev) {
      switch (ev.type) {
        case 'sold': return play('coin');
        case 'orderDone': return play('dingdong');
        case 'orderFailed': return play('warn');
        case 'orderNew': return play('bell');
        case 'made': return play(MADE_SOUND[ev.machine] ?? 'click');
        case 'crafted': return play('click');
        case 'built': return play('build');
        case 'removed': return play('remove');
        case 'unlocked':
        case 'zoneBought':
        case 'chapterDone':
        case 'ending': return play('fanfare');
        case 'bundled': return play('tape');
        case 'readerAssigned': return play('beep');
        default: return undefined;
      }
    },
    /** 매 프레임: 벨트 소리 크기와 정전 경고 */
    update(world, rules, running) {
      if (!ctx) return;
      let moving = 0;
      if (running) for (const st of world.stations) if (st.items?.length) moving++;
      const level = settings.muted ? 0 : Math.min(1, moving / 40) * 0.05;
      humGain.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
      const short = world.power.ratio < 1;
      if (short && !wasShort) play('warn');
      wasShort = short;
    },
  };
}
