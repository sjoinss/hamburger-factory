// 월드 그리기. 시뮬레이션 상태를 읽기만 하고 바꾸지 않는다.
import { TILE, getTile } from '../sim/grid.js';
import { readyRecipe, workSeconds, machineRecipe } from '../sim/station.js';
import { facingTile } from '../sim/interact.js';
import { tutorialTarget } from '../sim/tutorial.js';
import { isConveyorKind } from '../sim/conveyor.js';
import { inserterArmPhase } from '../sim/inserter.js';
import { DIRS } from '../sim/lookup.js';
import { viewOrigin } from './camera.js';

/** 칸 좌표 → 고정 난수. 바닥 얼룩/균열 위치를 매번 같게 만든다. */
function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function tileSprite(type, x, y) {
  const h = tileHash(x, y);
  if (type === TILE.WALL) return h % 7 === 0 ? 'wallRust' : 'wall';
  const light = (x + y) % 2 === 0;
  if (light) return h % 13 === 0 ? 'floorLightCrack' : 'floorLight';
  return h % 17 === 0 ? 'floorDarkOil' : 'floorDark';
}

const PLAYER_SPRITE = { down: 'playerDown', up: 'playerUp', left: 'playerLeft', right: 'playerRight' };

function playerFrame(player, walkFrameSeconds) {
  if (!player.moving) return 0;
  return 1 + (Math.floor(player.walkTime / walkFrameSeconds) % 2);
}

/** 0~1 진행률. 작업이 없으면 null. */
function stationProgress(rules, station) {
  if (station.progress <= 0) return null;
  const machine = rules.machines[station.type];
  if (machine.kind === 'source') return station.progress / machine.seconds;
  if (machine.kind === 'machine') {
    const recipe = machineRecipe(rules, station);
    return recipe ? station.progress / recipe.seconds : null;
  }
  const recipe = readyRecipe(rules, station);
  return recipe ? station.progress / workSeconds(rules, station, recipe) : null;
}

/**
 * @param ctx 2D 컨텍스트
 * @param view {{ width, height, scale }} 기기 픽셀 단위
 * @param alpha 틱 사이 보간 비율 0~1
 * @param hover 마우스가 가리키는 칸 {x,y} 또는 null
 * @param build 건설/철거 미리보기 (ui/build.js preview()) 또는 null
 */
export function drawWorld(ctx, world, bank, camera, view, alpha, hover, rules, effects, build) {
  const config = rules.game;
  const ts = config.tileSize;
  const s = view.scale;
  const cell = ts * s;
  const { ox, oy } = viewOrigin(camera, view);
  // 원본 픽셀 좌표 → 화면 기기 픽셀
  const sx = (px) => ox + Math.round(px) * s;
  const sy = (py) => oy + Math.round(py) * s;
  const sprite = (name, frame, px, py, rot = 0) => {
    const img = bank.get(name, frame, rot);
    ctx.drawImage(img, sx(px), sy(py), img.width * s, img.height * s);
  };
  const fillPx = (key, px, py, w, h) => {
    ctx.fillStyle = bank.color(key);
    ctx.fillRect(sx(px), sy(py), w * s, h * s);
  };
  const itemSprite = (item, px, py) => sprite(rules.items[item].sprite, 0, px, py);

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = bank.color('K');
  ctx.fillRect(0, 0, view.width, view.height);

  const { grid } = world;
  const x0 = Math.max(0, Math.floor(-ox / cell));
  const y0 = Math.max(0, Math.floor(-oy / cell));
  const x1 = Math.min(grid.width - 1, Math.floor((view.width - ox) / cell));
  const y1 = Math.min(grid.height - 1, Math.floor((view.height - oy) / cell));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      ctx.drawImage(bank.get(tileSprite(getTile(grid, x, y), x, y)), ox + x * cell, oy + y * cell, cell, cell);
    }
  }

  // 바닥층: 컨베이어류 (납작해서 y 정렬 없이 먼저). 갈빗살은 벨트 속도로 흐른다.
  const flat = [];
  for (const st of world.stations) {
    const m = rules.machines[st.type];
    if (!isConveyorKind(m.kind)) continue;
    flat.push(st);
    const frames = bank.frameCount(m.sprite);
    const frame = frames > 1 ? Math.floor((world.time * m.speed * ts) / 2) % frames : 0;
    sprite(m.sprite, frame, st.x * ts, st.y * ts, st.rot);
  }
  // 벨트 위 물건: 절반 크기 아이콘, 틱 사이 보간
  const miniAt = (it) => {
    const ix = (it.px + (it.x - it.px) * alpha) * ts - 4;
    const iy = (it.py + (it.y - it.py) * alpha) * ts - 4;
    const img = bank.mini(rules.items[it.item].sprite);
    ctx.drawImage(img, sx(ix), sy(iy), img.width * s, img.height * s);
  };
  for (const st of flat) {
    for (const it of st.items ?? []) miniAt(it);
    if (st.buffer) miniAt(st.buffer);
  }

  for (const g of world.groundItems) itemSprite(g.item, g.x * ts, g.y * ts);

  // 물체와 플레이어를 아래쪽 끝(y) 순서로 그린다.
  const p = world.player;
  const px = p.prevX + (p.x - p.prevX) * alpha;
  const py = p.prevY + (p.y - p.prevY) * alpha;
  const drawables = world.stations
    .filter((st) => !isConveyorKind(rules.machines[st.type].kind))
    .map((st) => ({ sortY: st.y + st.h, st }));
  drawables.push({ sortY: py + 0.3, player: true });
  drawables.sort((a, b) => a.sortY - b.sortY);

  const animFrame = Math.floor(world.time * 6) % 2;

  for (const d of drawables) {
    if (d.st) {
      const st = d.st;
      const machine = rules.machines[st.type];
      const frames = bank.frameCount(machine.sprite);
      const frame = st.active && frames > 1 ? 1 + animFrame : 0;
      sprite(machine.sprite, frame, st.x * ts, st.y * ts, st.rot);

      const bx = st.x * ts;
      const by = st.y * ts;
      if (machine.kind === 'inserter') {
        // 팔: 뒤(집기) → 가운데 → 앞(놓기). 든 물건은 집게 끝에 작게.
        const phase = inserterArmPhase(rules, st);
        sprite(machine.armSprite, phase, bx, by - 2, st.rot);
        if (st.held) {
          // 집게 끝 = 팔 축(가운데) + 방향 × 6px. 가운데 자세는 회전 기준 '위'를 향한다.
          const [dx, dy] = DIRS[st.rot];
          const vec = [[-dx, -dy], DIRS[(st.rot + 3) % 4], [dx, dy]][phase];
          const img = bank.mini(rules.items[st.held].sprite);
          ctx.drawImage(img, sx(bx + 8 + vec[0] * 6 - 4), sy(by + 6 + vec[1] * 6 - 4), img.width * s, img.height * s);
        }
      } else if (machine.kind === 'source') {
        itemSprite(st.item, bx, by - 3);
      } else if (machine.kind === 'machine') {
        // 자동 기계: 넣은 재료는 기계 안에 있다. 완성품만 위로 살짝 내민다.
        if (st.output.length > 0) itemSprite(st.output[0], bx + (st.w * ts - ts) / 2, by - 7);
      } else if (st.output.length > 0) {
        itemSprite(st.output[0], bx + (st.w * ts - ts) / 2, by - 2);
      } else if (st.contents.length > 0) {
        if (st.w === 1) itemSprite(st.contents[st.contents.length - 1], bx, by - 1);
        else st.contents.forEach((it, i) => itemSprite(it, bx - 1 + i * 9, by - 1));
      }
      if (machine.kind === 'machine' || machine.kind === 'inserter') {
        // 상태등: 오른쪽 위. 가동 = 깜박이는 초록 사각, 대기 = 노랑 점, 막힘 = 빨강 X
        const lamp = { running: 'lampRunning', idle: 'lampIdle', blocked: 'lampBlocked' }[st.status];
        sprite(lamp, animFrame, bx + st.w * ts - 6, by + 1);
      }
      continue;
    }
    // 원본 픽셀 격자에 맞춰 반올림해야 도트가 반 칸씩 어긋나지 않는다.
    const ppx = Math.round(px * ts) - ts / 2;
    const ppy = Math.round(py * ts) - ts + 2;
    sprite('shadow', 0, ppx, ppy);
    sprite(PLAYER_SPRITE[p.dir], playerFrame(p, config.player.walkFrameSeconds), ppx, ppy);
    // 들고 있는 물건: 머리 위에 쌓아서 보여준다.
    p.inventory.forEach((it, i) => {
      if (it) itemSprite(it, ppx, ppy - 10 - i * 6);
    });
  }

  // 작업 진행 막대 (색 + 길이. 정확한 %는 안내 문구에 텍스트로)
  for (const st of world.stations) {
    const ratio = stationProgress(rules, st);
    if (ratio === null) continue;
    const w = st.w * ts - 2;
    const bx = st.x * ts + 1;
    const by = st.y * ts - 5;
    ctx.fillStyle = bank.color('K');
    ctx.fillRect(sx(bx), sy(by), w * s, 4 * s);
    ctx.fillStyle = bank.color('1');
    ctx.fillRect(sx(bx + 1), sy(by + 1), (w - 2) * s, 2 * s);
    ctx.fillStyle = bank.color('G');
    ctx.fillRect(sx(bx + 1), sy(by + 1), Math.round((w - 2) * Math.min(1, ratio)) * s, 2 * s);
  }

  // 바라보는 칸, 마우스 칸 (건설 중에는 건설 미리보기만)
  if (build) {
    drawBuildPreview(build);
  } else {
    const target = facingTile(p, config.player.reach);
    sprite('tileTarget', 0, target.x * ts, target.y * ts);
    if (hover) sprite('tileCursor', 0, hover.x * ts, hover.y * ts);
  }

  // 튜토리얼 목표 화살표: 2프레임으로 위아래 까딱
  const goal = tutorialTarget(world, rules);
  if (goal) {
    const bob = Math.floor(world.time * 3) % 2 === 0 ? 0 : 2;
    sprite('tutorialArrow', 0, goal.x * ts + (goal.w * ts - 9) / 2, goal.y * ts - 14 + bob);
  }

  effects.draw(ctx, bank, sx, sy, s);

  /** 건설: 점무늬 미리보기 + 초록 테두리. 불가능/철거: 빨강 테두리 + X 무늬 (색만으로 구분하지 않는다) */
  function drawBuildPreview(b) {
    const px = b.x * ts;
    const py = b.y * ts;
    const w = b.w * ts;
    const h = b.h * ts;
    if (b.kind === 'place') {
      const img = bank.ghost(rules.machines[b.type].sprite, 0, b.rot);
      ctx.drawImage(img, sx(px), sy(py), img.width * s, img.height * s);
      // 방향 표시: 앞쪽 가장자리에 화살표 (투입기는 뒤 → 앞으로 옮긴다)
      const [dx, dy] = DIRS[b.rot];
      const arrow = bank.get('dirArrow', 0, b.rot);
      const ax = px + w / 2 - 3.5 + dx * (w / 2 - 2);
      const ay = py + h / 2 - 3.5 + dy * (h / 2 - 2);
      ctx.drawImage(arrow, sx(ax), sy(ay), arrow.width * s, arrow.height * s);
    }
    const key = b.ok ? 'G' : 'R';
    fillPx('K', px - 1, py - 1, w + 2, 1);
    fillPx('K', px - 1, py + h, w + 2, 1);
    fillPx('K', px - 1, py - 1, 1, h + 2);
    fillPx('K', px + w, py - 1, 1, h + 2);
    fillPx(key, px, py, w, 1);
    fillPx(key, px, py + h - 1, w, 1);
    fillPx(key, px, py, 1, h);
    fillPx(key, px + w - 1, py, 1, h);
    if (!b.ok || b.kind === 'remove') {
      // X 무늬: 칸마다 대각선 두 줄
      for (let i = 0; i < w; i += 1) {
        fillPx(key, px + i, py + Math.floor((i * h) / w), 1, 1);
        fillPx(key, px + w - 1 - i, py + Math.floor((i * h) / w), 1, 1);
      }
    }
  }
}
