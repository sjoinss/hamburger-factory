// 효과음 + 배경음악: 파일 없이 Web Audio API 로 합성한다. 첫 사용자 입력(클릭·키·터치) 뒤에만 AudioContext 를 연다.
// 시뮬레이션 사건(world.events)을 받아 소리로 바꾼다. 같은 소리가 몰리면 솎아 낸다 (4배속에서도 시끄럽지 않게).

const KEY = 'hamburger-factory:sound';
const DEFAULTS = Object.freeze({ muted: false, master: 0.35, sfx: 0.7, music: 0.4 });

// ── 배경음악: 잔잔한 칩튠 8마디 반복 (C - Am - F - G - C - Em - F - G) ──
const BPM = 92;
const STEP = 60 / BPM / 2; // 8분음표
// 멜로디 (MIDI 번호, 0 = 쉼, -1 = 앞 음을 끈다). 한 마디 8칸
const MELODY = [
  76, -1, 79, -1, 81, 79, 76, -1,
  72, -1, -1, 0, 74, 76, 72, -1,
  69, -1, 72, -1, 74, 72, 69, -1,
  67, -1, -1, 0, 0, 74, 72, 74,
  76, -1, 79, -1, 84, -1, 81, 79,
  76, -1, -1, 0, 79, 76, 74, -1,
  72, -1, 74, 76, 74, -1, 72, 69,
  72, -1, -1, -1, 0, 0, 0, 0,
];
const ROOTS = [48, 45, 41, 43, 48, 40, 41, 43];
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** 같은 소리 사이 최소 간격 (초) */
const GAP = { coin: 0.08, sizzle: 0.3, thud: 0.15, click: 0.12, build: 0.06, remove: 0.06, bell: 0.4, warn: 0.6, dingdong: 0.3, fanfare: 1, tape: 0.2, beep: 0.3 };

// 사건 → 소리
const MADE_SOUND = {
  grill: 'sizzle', fryer: 'sizzle', oven: 'sizzle', smelter: 'sizzle',
  pizza_oven: 'sizzle', chicken_fryer: 'sizzle', sauce_pot: 'sizzle',
  press: 'thud', gear_lathe: 'thud', meat_cutter: 'thud', potato_cutter: 'thud', sausage_maker: 'thud',
};

function readSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const vol = (v, d) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
    return { muted: raw.muted === true, master: vol(raw.master, DEFAULTS.master), sfx: vol(raw.sfx, DEFAULTS.sfx), music: vol(raw.music, DEFAULTS.music) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function createSound() {
  const settings = readSettings();
  let ctx = null;
  let master = null;
  let sfx = null;
  let music = null;
  let musicTimer = null;
  let nextNote = 0;
  let step = 0;
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
    music.gain.setTargetAtTime(settings.music, t, 0.05);
    syncMusic();
  }

  // ── 배경음악 스케줄러: 조금 앞까지 음을 미리 예약한다 (타이머가 늦어도 박자가 흔들리지 않게) ──
  function note(freq, at, dur, type, vol, dest = music) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.setValueAtTime(vol, at + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
  function scheduleMusic() {
    while (nextNote < ctx.currentTime + 0.3) {
      const i = step % MELODY.length;
      const bar = Math.floor(i / 8);
      const beat = i % 8;
      const m = MELODY[i];
      if (m > 0) {
        let len = 1;
        while (MELODY[(i + len) % MELODY.length] === -1) len++;
        note(hz(m), nextNote, STEP * len * 0.95, 'square', 0.035, musicLead);
      }
      const root = ROOTS[bar];
      if (beat === 0 || beat === 4) note(hz(root), nextNote, STEP * 1.8, 'triangle', 0.12);
      if (beat === 6) note(hz(root + 7), nextNote, STEP * 1.6, 'triangle', 0.09);
      if (beat % 2 === 1) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 7000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.012, nextNote);
        g.gain.exponentialRampToValueAtTime(0.0001, nextNote + 0.04);
        src.connect(f).connect(g).connect(music);
        src.start(nextNote, Math.random() * 0.5);
        src.stop(nextNote + 0.06);
      }
      nextNote += STEP;
      step += 1;
    }
  }
  let musicLead = null;
  /** 들릴 때만 돌린다 (음소거·음량 0·탭 숨김이면 멈춘다) */
  function syncMusic() {
    const on = ctx && ctx.state === 'running' && !settings.muted && settings.master > 0 && settings.music > 0 && !document.hidden;
    if (on && !musicTimer) {
      nextNote = ctx.currentTime + 0.1;
      musicTimer = setInterval(scheduleMusic, 100);
    } else if (!on && musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().then(syncMusic).catch(() => {});
    syncMusic();
  });

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume().then(syncMusic).catch(() => {});
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
    ctx.addEventListener?.('statechange', syncMusic);
    master = ctx.createGain();
    sfx = ctx.createGain();
    master.gain.value = 0;
    sfx.connect(master);
    music = ctx.createGain();
    music.gain.value = 0;
    music.connect(master);
    // 멜로디는 네모파가 날카롭지 않게 한 번 뭉갠다
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 1800;
    soft.connect(music);
    musicLead = soft;
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
        case 'built':
        case 'upgraded': return play('build');
        case 'removed': return play('remove');
        case 'unlocked':
        case 'zoneBought':
        case 'chapterDone':
        case 'challengeDone':
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
