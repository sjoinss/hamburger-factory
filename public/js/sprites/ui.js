// UI 기호 도트. 꼭 필요한 것만.

// 마우스가 가리키는 칸 표시 (모서리 꺾쇠)
export const TILE_CURSOR = [
  'KKKKK......KKKKK',
  'KyyyK......KyyyK',
  'KyKK........KKyK',
  'KyK..........KyK',
  'KK............KK',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  'KK............KK',
  'KyK..........KyK',
  'KyKK........KKyK',
  'KyyyK......KyyyK',
  'KKKKK......KKKKK',
];

// 플레이어가 바라보는(작업 대상) 칸 표시. 마우스 커서와 모양을 다르게.
export const TILE_TARGET = [
  '.KKK........KKK.',
  'KlllK......KlllK',
  'KlKK........KKlK',
  'KK............KK',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  'KK............KK',
  'KlKK........KKlK',
  'KlllK......KlllK',
  '.KKK........KKK.',
];

// 튜토리얼 목표를 가리키는 화살표 (9x9)
export const TUTORIAL_ARROW = [
  '..KKKKK..',
  '..KyyyK..',
  '..KyyyK..',
  'KKKyyyKKK',
  'KyyyyyyoK',
  '.KyyyyoK.',
  '..KyyoK..',
  '...KoK...',
  '....K....',
];

// 기계 상태등 (5x5). 색 + 모양으로 구분한다: 가동 = 꽉 찬 사각, 대기 = 빈 사각, 막힘 = X
export const LAMP_RUNNING = [
  ['KKKKK', 'KGGGK', 'KGlGK', 'KGGGK', 'KKKKK'],
  ['KKKKK', 'KGGGK', 'KGGGK', 'KGGGK', 'KKKKK'],
];
export const LAMP_IDLE = [
  'KKKKK',
  'KyyyK',
  'KyKyK',
  'KyyyK',
  'KKKKK',
];
export const LAMP_BLOCKED = [
  'KKKKK',
  'KRKRK',
  'KKRKK',
  'KRKRK',
  'KKKKK',
];

// 건설 미리보기 방향 표시 (오른쪽을 가리킴, 7x7)
export const DIR_ARROW = [
  '...K...',
  '...KK..',
  'KKKKyK.',
  'KyyyyyK',
  'KKKKyK.',
  '...KK..',
  '...K...',
];

// 병목 보기 무늬 (16x16, 칸마다 이어 붙인다). 막힘 = 빨강 45도 빗금, 한산 = 파랑 점
export const OVERLAY_JAM = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => ((x + y) % 4 === 0 ? 'R' : '.')).join(''));
// 2x2 점을 4px 간격으로, 줄마다 2px 어긋나게
export const OVERLAY_IDLE = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    const shift = Math.floor(y / 4) % 2 === 0 ? 0 : 2;
    const inDotRow = y % 4 === 1 || y % 4 === 2;
    const inDotCol = (x - shift + 4) % 4 < 2;
    return inDotRow && inDotCol ? 'p' : '.';
  }).join(''));

// 정전 깜박임: 한 칸 걸러 검정 (반투명 대신)
export const OVERLAY_DIM = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => ((x + y) % 2 === 0 ? 'K' : '.')).join(''));

// 로고 32×32: 공장 톱니바퀴 가운데에 햄버거. 톱니·테두리는 계산으로 찍고, 햄버거는 아이템 도트를 그대로 얹는다.
import { BURGER } from './items.js';
export const LOGO = (() => {
  const N = 32;
  const c = 15.5;
  const grid = Array.from({ length: N }, () => Array(N).fill('.'));
  const TEETH = 8;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - c, y - c);
      const a = Math.atan2(y - c, x - c);
      // 톱니: 바퀴 둘레 8개, 각 톱니는 각도 폭 안에서만 바깥으로 튀어나온다
      const phase = (((a / (2 * Math.PI)) * TEETH) % 1 + 1) % 1;
      const tooth = Math.abs(phase - 0.5) < 0.2;
      if (d <= 10.5) grid[y][x] = 'y';
      else if (d <= 13) grid[y][x] = d <= 11.5 ? '3' : '2';
      else if (d <= 15.5 && tooth) grid[y][x] = '2';
    }
  }
  // 바깥 테두리: 모양 밖과 맞닿은 칸
  const out = grid.map((r) => [...r]);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (grid[y][x] === '.') continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') === '.');
      if (edge) out[y][x] = 'k';
    }
  }
  // 노란 원판과 쇠 테 사이 그늘
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (out[y][x] === 'y' && Math.hypot(x - c, y - c) > 9.6) out[y][x] = 'o';
  // 햄버거 (16×16) 가운데
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (BURGER[y][x] !== '.') out[y + 8][x + 8] = BURGER[y][x];
  return out.map((r) => r.join(''));
})();
