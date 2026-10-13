// 문자열 도트 → 오프스크린 캔버스로 한 번 구워서(bake) 캐시한다.
// 위쪽 순수 함수들은 DOM 을 쓰지 않으므로 Node 테스트에서도 import 할 수 있다.
import * as tiles from '../sprites/tiles.js';
import * as characters from '../sprites/characters.js';
import * as items from '../sprites/items.js';
import * as machines from '../sprites/machines.js';
import * as ui from '../sprites/ui.js';

/** 이름 → 프레임 배열. 단일 그림도 프레임 1개짜리로 통일. */
export const SPRITE_DEFS = {
  floorLight: [tiles.FLOOR_LIGHT],
  floorDark: [tiles.FLOOR_DARK],
  floorLightCrack: [tiles.FLOOR_LIGHT_CRACK],
  floorDarkOil: [tiles.FLOOR_DARK_OIL],
  wall: [tiles.WALL],
  wallRust: [tiles.WALL_RUST],
  crate: [tiles.CRATE],
  playerDown: characters.PLAYER_DOWN,
  playerUp: characters.PLAYER_UP,
  playerRight: characters.PLAYER_RIGHT,
  playerLeft: characters.PLAYER_RIGHT.map((f) => flipRows(f)),
  shadow: [characters.SHADOW],
  cuttingBoard: [machines.CUTTING_BOARD],
  griddle: machines.GRIDDLE,
  assemblyTable: [machines.ASSEMBLY_TABLE],
  counter: [machines.COUNTER],
  grill: machines.GRILL,
  belt: machines.BELT,
  splitter: [machines.SPLITTER],
  merger: [machines.MERGER],
  inserterBase: [machines.INSERTER_BASE],
  inserterArm: machines.INSERTER_ARM,
  supply: machines.SUPPLY,
  meatCutter: machines.MEAT_CUTTER,
  washer: machines.WASHER,
  mixer: machines.MIXER,
  oven: machines.OVEN,
  burgerAssembler: machines.BURGER_ASSEMBLER,
  rawMeat: [items.RAW_MEAT],
  groundMeat: [items.GROUND_MEAT],
  patty: [items.PATTY],
  bun: [items.BUN],
  lettuce: [items.LETTUCE],
  lettuceWashed: [items.LETTUCE_WASHED],
  burger: [items.BURGER],
  coin: [items.COIN],
  ironPlate: [items.IRON_PLATE],
  heatPlate: [items.HEAT_PLATE],
  gear: [items.GEAR],
  flour: [items.FLOUR],
  dough: [items.DOUGH],
  tileCursor: [ui.TILE_CURSOR],
  tileTarget: [ui.TILE_TARGET],
  tutorialArrow: [ui.TUTORIAL_ARROW],
  lampRunning: ui.LAMP_RUNNING,
  lampIdle: [ui.LAMP_IDLE],
  lampBlocked: [ui.LAMP_BLOCKED],
  dirArrow: [ui.DIR_ARROW],
  overlayJam: [ui.OVERLAY_JAM],
  overlayIdle: [ui.OVERLAY_IDLE],
};

export function flipRows(rows) {
  return rows.map((r) => [...r].reverse().join(''));
}

/** 시계 방향 90도 회전 (정사각/직사각 모두). */
export function rotateRows(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const out = [];
  for (let x = 0; x < w; x++) {
    let line = '';
    for (let y = h - 1; y >= 0; y--) line += rows[y][x];
    out.push(line);
  }
  return out;
}

/** 건설 미리보기용: 체크무늬로 한 칸씩 비운다 (반투명 대신 팔레트 색만 유지) */
export function ditherRows(rows, transparent = '.') {
  return rows.map((r, y) => [...r].map((ch, x) => ((x + y) % 2 === 0 ? ch : transparent)).join(''));
}

/**
 * 벨트 위 등에 쓰는 절반 크기 아이콘: 2×2 칸마다 가장 많은 색을 고른다 (팔레트 밖 색이 생기지 않게).
 * 칸의 절반 이상이 투명이면 투명.
 */
export function miniRows(rows, transparent = '.') {
  const out = [];
  for (let y = 0; y + 1 < rows.length; y += 2) {
    let line = '';
    for (let x = 0; x + 1 < rows[0].length; x += 2) {
      const block = [rows[y][x], rows[y][x + 1], rows[y + 1][x], rows[y + 1][x + 1]].filter((c) => c !== transparent);
      if (block.length < 2) { line += transparent; continue; }
      const counts = {};
      for (const c of block) counts[c] = (counts[c] ?? 0) + 1;
      line += Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }
    out.push(line);
  }
  return out;
}

/** palette.json → { key: hex } */
export function paletteMap(palette) {
  const map = Object.create(null);
  for (const c of palette.colors) map[c.key] = c.hex;
  return map;
}

/** 모양/팔레트 검사. 문제 목록을 돌려준다 (빈 배열이면 정상). */
export function validateSprite(name, rows, colors, transparent = '.') {
  const problems = [];
  if (!Array.isArray(rows) || rows.length === 0) return [`${name}: 비어 있음`];
  const w = rows[0].length;
  rows.forEach((r, y) => {
    if (r.length !== w) problems.push(`${name}: ${y}행 길이 ${r.length} (기대 ${w})`);
    for (const ch of r) {
      if (ch !== transparent && !(ch in colors)) problems.push(`${name}: ${y}행 팔레트에 없는 문자 '${ch}'`);
    }
  });
  return problems;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 브라우저 전용: 도트 한 장을 1:1 크기 캔버스로 굽는다. */
export function bakeSprite(rows, colors, transparent = '.') {
  const h = rows.length;
  const w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const rgbCache = Object.create(null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === transparent) continue;
      const rgb = (rgbCache[ch] ??= hexToRgb(colors[ch]));
      const i = (y * w + x) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** 시작 시 전부 구워 두고, 매 프레임에는 캐시만 꺼내 쓴다. */
export function createSpriteBank(palette) {
  const colors = paletteMap(palette);
  const transparent = palette.transparent ?? '.';
  const baked = Object.create(null);
  for (const [name, frames] of Object.entries(SPRITE_DEFS)) {
    const problems = frames.flatMap((f, i) => validateSprite(`${name}[${i}]`, f, colors, transparent));
    if (problems.length) throw new Error(`스프라이트 오류\n${problems.join('\n')}`);
    baked[name] = frames.map((f) => bakeSprite(f, colors, transparent));
  }
  // 회전/미리보기 변형은 처음 쓸 때 한 번만 굽는다.
  const variants = new Map();
  function variant(name, frame, rot, ghost, mini = false) {
    const frames = SPRITE_DEFS[name];
    if (!frames) throw new Error(`알 수 없는 스프라이트: ${name}`);
    const f = frame % frames.length;
    const key = `${name}|${f}|${rot}|${ghost ? 1 : 0}|${mini ? 1 : 0}`;
    let canvas = variants.get(key);
    if (!canvas) {
      let rows = frames[f];
      for (let i = 0; i < rot; i++) rows = rotateRows(rows);
      if (ghost) rows = ditherRows(rows, transparent);
      if (mini) rows = miniRows(rows, transparent);
      canvas = bakeSprite(rows, colors, transparent);
      variants.set(key, canvas);
    }
    return canvas;
  }

  return {
    get(name, frame = 0, rot = 0) {
      if (rot % 4 !== 0) return variant(name, frame, rot % 4, false);
      const frames = baked[name];
      if (!frames) throw new Error(`알 수 없는 스프라이트: ${name}`);
      return frames[frame % frames.length];
    },
    ghost: (name, frame = 0, rot = 0) => variant(name, frame, rot % 4, true),
    mini: (name) => variant(name, 0, 0, false, true),
    has: (name) => Object.hasOwn(baked, name),
    frameCount: (name) => baked[name]?.length ?? 0,
    color: (key) => colors[key],
  };
}
