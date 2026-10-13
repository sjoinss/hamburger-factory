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
