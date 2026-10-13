// 부팅과 메인 루프. 로직은 고정 20틱/초, 렌더는 requestAnimationFrame + 보간.
import { loadData } from './data.js';
import { createWorld, stepWorld } from './sim/world.js';
import { inBounds } from './sim/grid.js';
import { findInteraction, facingTile } from './sim/interact.js';
import { createSpriteBank } from './render/sprites.js';
import { createCamera, pixelScale, setZoom, clampCamera, screenToWorld } from './render/camera.js';
import { drawWorld } from './render/world.js';
import { createEffects } from './render/effects.js';
import { createInput } from './input.js';
import { createHud, checkPixelFont } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { createRecipeBook } from './ui/recipebook.js';
import { createTutorialCard } from './ui/tutorial.js';
import { createBuildMode } from './ui/build.js';
import { createInspector } from './ui/inspect.js';
import { createStatsPanel } from './ui/stats.js';
import { createOrderBoard } from './ui/orders.js';
import { stationAt } from './sim/lookup.js';
import { createWalker } from './ui/walk.js';
import { createSound } from './audio/sound.js';
import { createSettings, readSavedGame } from './ui/settings.js';
import { replaceWorld } from './sim/save.js';
import { createChapterView } from './ui/chapters.js';

const FONT_FAMILY = '"Galmuri11", ui-monospace, monospace';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const stage = document.getElementById('app');

const view = { width: 1, height: 1, scale: 1, dpr: 1, padTop: 0, padBottom: 0 };

/** 상단 바와 (터치일 때) 아래 조작부가 가리는 높이. 카메라가 보이는 부분 가운데에 맞추도록. */
function updateViewPadding() {
  const appRect = stage.getBoundingClientRect();
  const top = document.querySelector('.topbar').getBoundingClientRect().bottom - appRect.top;
  const controls = document.getElementById('touch-controls');
  const shown = getComputedStyle(controls).display !== 'none';
  const bottom = shown ? appRect.bottom - controls.getBoundingClientRect().top : 0;
  view.padTop = Math.max(0, Math.round(top * view.dpr));
  view.padBottom = Math.max(0, Math.round(bottom * view.dpr));
}

function resizeCanvas(camera) {
  const dpr = window.devicePixelRatio || 1;
  const rect = stage.getBoundingClientRect();
  view.width = Math.max(1, Math.floor(rect.width * dpr));
  view.height = Math.max(1, Math.floor(rect.height * dpr));
  view.dpr = dpr;
  view.scale = pixelScale(camera, dpr);
  canvas.width = view.width;
  canvas.height = view.height;
  canvas.style.setProperty('width', `${view.width / dpr}px`);
  canvas.style.setProperty('height', `${view.height / dpr}px`);
}

function drawLogo(bank) {
  const logo = document.getElementById('logo-sprite');
  const lctx = logo.getContext('2d');
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(bank.get('burger'), 0, 0);
}

function showFatal(text) {
  const el = document.getElementById('stage-msg');
  el.textContent = text;
  el.hidden = false;
}

async function boot() {
  let rules;
  let bank;
  try {
    const data = await loadData();
    rules = data.rules;
    bank = createSpriteBank(data.palette);
    for (const def of [...Object.values(rules.items), ...Object.values(rules.machines)]) {
      if (!bank.has(def.sprite)) throw new Error(`스프라이트 없음: ${def.sprite}`);
    }
  } catch (err) {
    showFatal(`시작 실패: ${err.message}`);
    console.error(err);
    return;
  }
  const config = rules.game;
  const ts = config.tileSize;

  const state = { speed: 1, speedBeforeHidden: 1 };
  const hud = createHud({ onSpeed: (s) => setSpeed(s), bank, rules });
  function setSpeed(s) {
    state.speed = s;
    hud.setSpeed(s);
  }

  checkPixelFont().then((ok) => hud.showFontNotice(!ok));
  drawLogo(bank);

  const world = createWorld(rules);
  // 저장된 공장이 있으면 이어서 (망가졌으면 새로 시작하고 알려 준다)
  const saved = readSavedGame(rules);
  if (saved.world) replaceWorld(world, saved.world);
  const sound = createSound();
  const camera = createCamera(config.camera);
  // 개발용: 주소 끝에 #debug 를 붙이면 콘솔에서 상태를 볼 수 있다.
  const effects = createEffects(ts, FONT_FAMILY);
  const recipeBook = createRecipeBook({ bank, rules });
  let build = null;
  const panels = createPanels({
    onOpen: (name) => {
      if (name === 'recipes') recipeBook.render(world);
      if (name === 'build') build.renderPanel();
    },
    returnFocus: () => canvas.focus({ preventScroll: true }),
  });
  build = createBuildMode({ world, rules, bank, panels });
  const inspector = createInspector({ world, rules, bank });
  const statsPanel = createStatsPanel({ world, rules, bank });
  const chapterView = createChapterView({ world, rules, bank });
  const orderBoard = createOrderBoard({
    world,
    rules,
    bank,
    onAssigned: () => hud.banner('출고 게이트에 맡겼다', 2),
  });

  // 병목 보기 (O 키 / 상단 '병목' 버튼)
  let overlay = false;
  const overlayBtn = document.querySelector('[data-ui="overlay"]');
  const overlayLegend = document.getElementById('overlay-legend');
  const setOverlay = (on) => {
    overlay = on;
    overlayBtn.setAttribute('aria-pressed', String(on));
    overlayLegend.hidden = !on;
    document.body.classList.toggle('has-legend', on);
  };
  overlayBtn.addEventListener('click', () => setOverlay(!overlay));

  // 모바일: 화면을 탭하면 그곳으로 걷는다 (기계를 탭하면 그 앞으로 가서 바라본다)
  const walker = createWalker({ world, rules });
  const facingStation = () => {
    const t = facingTile(world.player, config.player.reach);
    return stationAt(world, t.x, t.y);
  };
  function tapAt(x, y) {
    const st = stationAt(world, x, y);
    if (st) {
      // 이미 그 기계 앞에서 바라보고 있으면 정보, 아니면 그 앞으로
      if (!walker.active() && facingStation() === st) inspect(st);
      else if (!walker.walkToStation(st)) hud.banner('갈 수 없는 곳', 1.5);
      return;
    }
    if (!walker.walkTo(x, y)) hud.banner('갈 수 없는 곳', 1.5);
  }

  const inspect = (st) => {
    inspector.select(st ? st.id : null);
    if (st) panels.open('info');
  };
  let hover = null;
  let mouseWasDown = false;
  // 건설을 시작하면 마우스가 가리키는 칸, 없으면 플레이어가 바라보는 칸에서 시작
  build.setStartCursor(() => hover ?? facingTile(world.player, config.player.reach));
  // 개발용 주소 플래그: #debug (콘솔에서 __game 으로 상태 보기), #touch (PC 에서 터치 화면 미리보기). 쉼표로 함께 쓸 수 있다.
  const flags = new Set(location.hash.slice(1).split(','));
  if (flags.has('debug')) window.__game = { world, rules, camera, build, panels };
  // #unlock: 모든 단계를 바로 연다 (해금 조건인 판매 수를 채워 둔다. 시험용)
  if (flags.has('unlock')) {
    for (const st of rules.progression.stages) {
      for (const [item, n] of Object.entries(st.when.sold)) world.stats.sold[item] = Math.max(world.stats.sold[item] ?? 0, n);
    }
  }
  const tutorialCard = createTutorialCard({ rules, world, onRestart: () => panels.close() });

  // 불러오기 / 새로 시작: 화면 모듈들이 같은 world 객체를 붙잡고 있으므로 내용만 바꾼다
  const settings = createSettings({
    world,
    rules,
    sound,
    banner: (text, s) => hud.banner(text, s),
    onReplace: (next) => {
      replaceWorld(world, next ?? createWorld(rules));
      build.cancel();
      walker.cancel();
      inspector.select(null);
      panels.close();
      document.getElementById('ending').hidden = true;
      camera.follow = true;
    },
  });
  if (saved.error) hud.banner(saved.error, 4);
  else if (saved.world) {
    hud.banner('이어서 하기', 1.5);
  }
  if (flags.has('debug')) Object.assign(window.__game, { sound, settings });

  const coarse = window.matchMedia('(pointer: coarse)').matches || flags.has('touch');
  const enterTouchMode = () => {
    hud.setTouchMode(true);
    setZoom(camera, config.camera.mobileZoom);
    view.scale = pixelScale(camera, view.dpr);
  };
  const input = createInput(
    canvas,
    {
      interactBtn: document.getElementById('btn-interact'),
      dropBtn: document.getElementById('btn-drop'),
    },
    {
      pinchStep: config.touch.pinchStep,
      onTouchMode: enterTouchMode,
      touchDraws: () => build.touchDraws(),
    },
  );

  const worldW = world.grid.width * ts;
  const worldH = world.grid.height * ts;

  resizeCanvas(camera);
  new ResizeObserver(() => resizeCanvas(camera)).observe(stage);
  if (coarse) enterTouchMode();
  setSpeed(1);

  // 탭이 백그라운드로 가면 멈추고, 돌아와도 밀린 시간은 계산하지 않는다.
  let acc = 0;
  let last = performance.now();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.speedBeforeHidden = state.speed;
      setSpeed(0);
    } else {
      setSpeed(state.speedBeforeHidden);
      acc = 0;
      last = performance.now();
    }
  });

  const tickDt = 1 / config.ticksPerSecond;

  function frame(now) {
    const realDt = Math.min((now - last) / 1000, 0.25);
    last = now;

    // ── 화면 조작 (게임 속도와 무관하게 실제 시간 기준) ──
    if (input.consumePress('Space')) setSpeed(state.speed === 0 ? (state.speedBeforeHidden || 1) : 0);
    if (state.speed !== 0) state.speedBeforeHidden = state.speed;
    if (input.consumePress('KeyC')) camera.follow = true;

    let zoomStep = input.consumeZoom();
    if (input.consumePress('Equal') || input.consumePress('NumpadAdd')) zoomStep += 1;
    if (input.consumePress('Minus') || input.consumePress('NumpadSubtract')) zoomStep -= 1;
    if (zoomStep !== 0) {
      setZoom(camera, camera.zoom + Math.sign(zoomStep));
      view.scale = pixelScale(camera, view.dpr);
    }

    // ── 건설 모드 ──
    if (input.consumePress('KeyX')) build.toggleRemove();
    if (input.consumePress('KeyO')) setOverlay(!overlay);
    if (input.consumePress('KeyF')) {
      const t = facingTile(world.player, config.player.reach);
      inspect(stationAt(world, t.x, t.y));
    }
    if (build.active()) {
      if (input.consumePress('KeyR')) build.rotate();
      if (input.consumePress('Enter')) build.confirm();
      const arrows = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      for (const [code, [dx, dy]] of Object.entries(arrows)) {
        if (!input.consumePress(code)) continue;
        build.moveCursor(dx, dy);
        const c = build.cursor();
        camera.follow = false;
        camera.x = (c.x + 0.5) * ts;
        camera.y = (c.y + 0.5) * ts;
      }
    }
    const toTile = (p) => {
      const w = screenToWorld(camera, view, p.x * view.dpr, p.y * view.dpr);
      return { x: Math.floor(w.x / ts), y: Math.floor(w.y / ts) };
    };
    // 마우스: 누르는 순간 설치 (끌면 이어서). 터치: 탭으로 칸만 고르고 설치 버튼으로 확정 (실수 방지)
    for (const press of input.consumePresses()) {
      if (!build.active()) continue;
      const t = toTile(press);
      build.pressAt(t.x, t.y);
    }
    for (const click of input.consumeClicks()) {
      if (!build.active()) {
        if (click.button !== 0) continue;
        const t = toTile(click);
        // 터치: 탭 = 이동 / 마우스: 클릭 = 기계 상태 보기 (PC 는 키보드로 걷는다)
        if (click.touch) tapAt(t.x, t.y);
        else inspect(stationAt(world, t.x, t.y));
        continue;
      }
      if (click.button === 2) { build.cancel(); continue; }
      if (!click.touch) continue;
      const t = toTile(click);
      build.setCursor(t.x, t.y);
    }
    // 터치로 끌어서 깔기
    for (const stroke of input.consumeStrokes()) {
      if (stroke.type === 'end') { build.endDrag(); continue; }
      const t = toTile(stroke);
      if (stroke.type === 'start') build.pressAt(t.x, t.y);
      else build.dragTo(t.x, t.y);
    }
    // 마우스 왼쪽을 뗀 순간에만 끌기 끝 (터치 그리기는 stroke 'end' 로 끝난다)
    if (mouseWasDown && !input.mouse.left) build.endDrag();
    mouseWasDown = input.mouse.left;

    const pan = build.active() ? { x: 0, y: 0 } : input.panVector();
    const drag = input.consumeDrag();
    if (pan.x || pan.y || drag.x || drag.y) camera.follow = false;
    camera.x += pan.x * config.camera.panTilesPerSecond * ts * realDt - (drag.x * view.dpr) / view.scale;
    camera.y += pan.y * config.camera.panTilesPerSecond * ts * realDt - (drag.y * view.dpr) / view.scale;

    // ── 시뮬레이션 ──
    acc += realDt * state.speed;
    let steps = 0;
    while (acc >= tickDt && steps < config.maxTicksPerFrame) {
      const intent = input.tickIntent();
      if (intent.moveX || intent.moveY) walker.cancel(); // 키보드로 걸으면 탭 이동은 취소
      else {
        const auto = walker.intent();
        if (auto) Object.assign(intent, auto);
      }
      // 걷기 시작하면 카메라도 다시 따라간다.
      if (intent.moveX || intent.moveY) camera.follow = true;
      stepWorld(world, intent, tickDt, rules);
      acc -= tickDt;
      steps++;
    }
    if (steps === config.maxTicksPerFrame) acc = 0;
    if (state.speed === 0) input.clearTaps();
    const alpha = Math.min(1, acc / tickDt);

    for (const ev of world.events) {
      effects.push(ev);
      sound.event(ev);
      if (ev.type === 'sold') hud.flashMoney();
      if (ev.type === 'orderDone') {
        hud.flashMoney();
        hud.banner(ev.bundled ? `묶음 주문 완료 +${ev.reward} (보너스)` : `주문 완료 +${ev.reward}`, 2);
      }
      if (ev.type === 'zoneBought') {
        const z = rules.zones.zones.find((x) => x.id === ev.zone);
        hud.banner(`${z.name} 매입!`, 2);
      }
      if (ev.type === 'chapterDone') {
        const done = rules.chapters.find((c) => c.id === ev.chapter);
        const next = rules.chapters[world.chapters.index];
        hud.flashMoney();
        hud.banner(`${done.name} 완료!${ev.reward.money ? ` +${ev.reward.money}` : ''}`, 3);
      }
      if (ev.type === 'ending') chapterView.showEnding();
      if (ev.type === 'orderFailed') hud.banner('손님이 떠났다', 2);
      if (ev.type === 'orderNew' && panels.current() === 'orders') orderBoard.forceRender();
      if (ev.type === 'unlocked') {
        hud.banner(`새 기계 ${ev.machines.length}개!`, 3);
      }
      if (ev.type === 'unlocked' || ev.type === 'built' || ev.type === 'removed') {
        if (panels.current() === 'build') build.renderPanel();
      }
    }
    world.events.length = 0;
    sound.update(world, rules, state.speed > 0);
    effects.update(realDt);
    tutorialCard.update(realDt);
    build.update(realDt);

    // ── 렌더 ──
    const p = world.player;
    if (camera.follow) {
      camera.x = (p.prevX + (p.x - p.prevX) * alpha) * ts;
      camera.y = (p.prevY + (p.y - p.prevY) * alpha) * ts;
    }
    updateViewPadding();
    clampCamera(camera, view, worldW, worldH);

    const prevHover = hover;
    hover = null;
    if (input.mouse.inside) {
      const w = screenToWorld(camera, view, input.mouse.x * view.dpr, input.mouse.y * view.dpr);
      const hx = Math.floor(w.x / ts);
      const hy = Math.floor(w.y / ts);
      if (inBounds(world.grid, hx, hy)) hover = { x: hx, y: hy };
    }
    // 마우스가 다른 칸으로 움직였을 때만 건설 커서를 따라가게 (방향키 이동과 다투지 않게)
    if (build.active() && hover && (hover.x !== prevHover?.x || hover.y !== prevHover?.y)) {
      if (input.mouse.left) build.dragTo(hover.x, hover.y);
      else build.setCursor(hover.x, hover.y);
    }

    drawWorld(ctx, world, bank, camera, view, alpha, hover, rules, effects, build.preview(), {
      overlay,
      destination: walker.destination(),
      fontFamily: FONT_FAMILY,
      selected: panels.current() === 'info' ? inspector.selected() : null,
    });
    if (panels.current() === 'info') inspector.render();
    if (panels.current() === 'stats') {
      chapterView.render();
      statsPanel.render(now);
    }
    if (panels.current() === 'orders') orderBoard.render(now);

    hud.update(world, {
      interaction: findInteraction(world, rules),
      buildPrompt: build.describe(input.isTouchMode() || coarse),
      touch: input.isTouchMode() || coarse,
    });

    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
