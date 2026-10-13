// 밭과 빵 작업대 도트. 밭은 자란 정도에 따라 4프레임 (0 씨앗 → 3 다 자람).
import { blank, plot, rect, frame } from './draw.js';

// 밀: 이삭 한 다발
export const WHEAT = [
  '................',
  '......o..o......',
  '.....oyo.yo.....',
  '....oyyoyyo.....',
  '....kyyoyyk.....',
  '.....kyyyk..o...',
  '......kyk..oyo..',
  '......kgk.oyyo..',
  '......kgk.kyk...',
  '......kgkkkgk...',
  '.......kggggk...',
  '.......kgggk....',
  '........kkk.....',
  '................',
  '................',
  '................',
];

/** 공통 밭: 나무 울타리 + 갈아 놓은 흙 이랑 */
function plot2x2() {
  let r = blank(32, 32);
  r = rect(r, 0, 0, 32, 31, 'd');
  for (let y = 4; y < 30; y += 7) r = rect(r, 2, y + 3, 28, 1, 'm'); // 이랑 사이 골
  r = frame(r, 0, 0, 32, 31, 'B');
  r = frame(r, 1, 1, 30, 29, 'b');
  r = rect(r, 1, 31, 31, 1, 'K');
  // 울타리 말뚝 (간격 일부러 불규칙)
  r = plot(r, [[0, 0, 'k'], [31, 0, 'k'], [0, 30, 'k'], [31, 30, 'k'], [13, 0, 'k'], [20, 30, 'k'], [0, 17, 'k'], [31, 11, 'k']]);
  return r;
}

const ROWS = [5, 12, 19, 26];
const COLS = [4, 9, 14, 19, 24];

function cropField(drawPlant) {
  return [0, 1, 2, 3].map((stage) => {
    let r = plot2x2();
    ROWS.forEach((y, j) => COLS.forEach((x, i) => {
      r = drawPlant(r, x + ((j % 2) ? 2 : 0), y, stage, i + j);
    }));
    return r;
  });
}

export const FIELD_WHEAT = cropField((r, x, y, stage) => {
  if (stage === 0) return plot(r, [[x, y + 1, 'g']]);
  if (stage === 1) return plot(r, [[x, y, 'g'], [x, y + 1, 'g'], [x + 1, y - 1, 'g']]);
  if (stage === 2) return plot(r, [[x, y - 2, 'g'], [x, y - 1, 'g'], [x, y, 'G'], [x, y + 1, 'G'], [x + 1, y - 2, 'g'], [x - 1, y - 1, 'g']]);
  // 다 자람: 금빛 이삭
  return plot(r, [[x, y - 3, 'o'], [x, y - 2, 'y'], [x + 1, y - 2, 'y'], [x, y - 1, 'y'], [x - 1, y - 1, 'o'], [x, y, 'G'], [x, y + 1, 'G']]);
});

export const FIELD_LETTUCE = cropField((r, x, y, stage, k) => {
  if (stage === 0) return plot(r, [[x, y + 1, 'g']]);
  if (stage === 1) return plot(r, [[x, y, 'g'], [x + 1, y, 'g']]);
  if (stage === 2) return plot(r, [[x, y - 1, 'g'], [x - 1, y, 'g'], [x, y, 'G'], [x + 1, y, 'g'], [x, y + 1, 'G']]);
  // 다 자람: 동그란 포기 (몇 개는 밝은 잎)
  const hi = k % 3 === 0 ? 'l' : 'g';
  return plot(r, [
    [x - 1, y - 1, 'g'], [x, y - 1, hi], [x + 1, y - 1, 'g'],
    [x - 2, y, 'g'], [x - 1, y, 'G'], [x, y, 'g'], [x + 1, y, 'G'], [x + 2, y, 'g'],
    [x - 1, y + 1, 'G'], [x, y + 1, 'G'], [x + 1, y + 1, 'G'],
  ]);
});

// 맷돌: 둥근 돌 두 장 + 손잡이
export const HAND_MILL = (() => {
  let r = blank(16, 16);
  r = rect(r, 2, 4, 12, 10, '2');
  r = frame(r, 2, 4, 12, 10, 'k');
  r = plot(r, [[2, 4, '.'], [13, 4, '.'], [2, 13, '.'], [13, 13, '.'], [3, 5, 'k'], [12, 5, 'k'], [3, 12, 'k'], [12, 12, 'k']]);
  r = rect(r, 3, 8, 10, 1, 'k'); // 위·아래 돌 사이
  r = rect(r, 4, 5, 8, 2, '3');
  r = plot(r, [[7, 6, 'K'], [8, 6, 'K'], [5, 10, 'l'], [9, 11, 'l'], [11, 10, 'l']]); // 구멍, 가루
  r = rect(r, 12, 1, 2, 5, 'B'); // 손잡이
  r = frame(r, 12, 1, 2, 5, 'k');
  r = rect(r, 3, 14, 12, 1, 'K');
  return r;
})();

// 반죽대: 나무 탁자 위 밀가루 흩날림 + 밀대
export const DOUGH_TABLE = (() => {
  let r = blank(16, 16);
  r = rect(r, 0, 2, 16, 12, 'b');
  r = frame(r, 0, 2, 16, 12, 'k');
  r = rect(r, 1, 3, 14, 1, 'o');
  for (const y of [6, 10]) r = rect(r, 1, y, 14, 1, 'B'); // 나뭇결
  r = plot(r, [[3, 5, 'l'], [4, 5, 'l'], [5, 8, 'l'], [10, 7, 'l'], [11, 11, 'l'], [7, 12, 'l']]);
  r = rect(r, 3, 9, 10, 2, 'f'); // 밀대
  r = frame(r, 3, 9, 10, 2, 'k');
  r = rect(r, 1, 14, 15, 1, 'K');
  return r;
})();

// 화덕: 벽돌 아치, 굽는 중이면 불꽃이 바뀐다
const HEARTH_BASE = (() => {
  let r = blank(16, 16);
  r = rect(r, 0, 1, 16, 13, 'r');
  for (let y = 1; y < 14; y += 3) r = rect(r, 0, y, 16, 1, 'k'); // 벽돌 줄
  for (let y = 2; y < 14; y += 3) for (let x = (y % 2) * 3; x < 16; x += 6) r = plot(r, [[x, y, 'k'], [x, y + 1, 'k']]);
  r = frame(r, 0, 1, 16, 13, 'k');
  r = rect(r, 4, 6, 8, 7, 'K'); // 아궁이
  r = plot(r, [[4, 6, 'r'], [11, 6, 'r'], [5, 5, 'k'], [6, 5, 'k'], [9, 5, 'k'], [10, 5, 'k'], [7, 4, 'k'], [8, 4, 'k']]);
  r = rect(r, 1, 14, 15, 1, 'K');
  return r;
})();
export const HEARTH = [
  HEARTH_BASE,
  plot(HEARTH_BASE, [[6, 11, 'o'], [7, 10, 'y'], [8, 11, 'o'], [9, 10, 'r'], [7, 11, 'o'], [8, 9, 'y']]),
  plot(HEARTH_BASE, [[6, 10, 'r'], [7, 11, 'o'], [8, 10, 'y'], [9, 11, 'o'], [6, 11, 'o'], [7, 9, 'y']]),
];

// 제분기: 위에 깔때기, 옆에 돌아가는 바퀴
export const MILL = [0, 1, 2].map((f) => {
  let r = blank(16, 16);
  r = rect(r, 1, 6, 14, 8, '1');
  r = rect(r, 2, 7, 12, 1, '2');
  r = frame(r, 1, 6, 14, 8, 'k');
  // 깔때기
  r = rect(r, 3, 1, 8, 2, '3');
  r = rect(r, 4, 3, 6, 2, '2');
  r = rect(r, 6, 5, 2, 1, '2');
  r = plot(r, [[3, 1, 'k'], [10, 1, 'k'], [4, 3, 'k'], [9, 3, 'k']]);
  // 바퀴 (프레임마다 살 위치)
  r = rect(r, 11, 8, 4, 4, '2');
  r = frame(r, 11, 8, 4, 4, 'k');
  const spoke = [[12, 9], [13, 10], [12, 10]][f];
  r = plot(r, [[spoke[0], spoke[1], 'K']]);
  r = plot(r, [[3, 11, 'l'], [4, 12, 'l'], [5, 11, 'l']]); // 가루 나오는 곳
  r = rect(r, 2, 14, 14, 1, 'K');
  return r;
});
