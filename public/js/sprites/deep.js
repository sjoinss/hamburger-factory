// M16~ 도트: 메뉴 변형(치즈·더블·베이컨버거, 웨지감자), 훈연기, 부산물·후반 메뉴 재료와 기계.
import { blank, plot, rect, frame } from './draw.js';
import { lump, box, frames3 } from './menu.js';
import { BURGER } from './items.js';

// ── 버거 변형: 기본 햄버거 도트에서 한 줄씩 바꾼다 ──
const row = (rows, y, text) => rows.map((r, i) => (i === y ? text : r));

// 치즈버거: 양상추 위에 노란 치즈, 한쪽으로 흘러내림
export const CHEESEBURGER = plot(row(BURGER, 6, '..kccccccccccck.'), [[4, 7, 'c'], [10, 7, 'c'], [11, 8, 'c']]);

// 더블버거: 패티 두 장 (키가 크다)
export const DOUBLE_BURGER = [
  '.....kkkkkk.....',
  '...kkbbbbbbkk...',
  '..kbblbbbbbbbk..',
  '..kbbbbblbbbBk..',
  '..kkkkkkkkkkkk..',
  '..kgggggggggggk.',
  '..kmmMmmmmmMmk..',
  '..kkkkkkkkkkkk..',
  '..kmmmmmMmmmmk..',
  '..kmmmmmmmmmmk..',
  '..kkkkkkkkkkkk..',
  '..kbbbbbbbbbBk..',
  '...kkBBBBBBkk...',
  '.....kkkkkk.....',
  '................',
  '................',
];

// 베이컨버거: 양상추 대신 빨강·하양 줄무늬 베이컨
export const BACON_BURGER = row(BURGER, 6, '..ktftftftftftk.');

// 돼지고기: 분홍 덩어리 + 비계 줄
export const PORK = plot(lump(8, 9, 5.5, 's', 'S', 'l'), [[5, 8, 'l'], [6, 9, 'l'], [7, 10, 'l'], [8, 11, 'l']]);

// 베이컨: 물결치는 띠
export const BACON = (() => {
  let r = blank(16, 16);
  for (let x = 1; x < 15; x++) {
    const y = 5 + Math.round(Math.sin(x / 2) * 1.5);
    r = plot(r, [[x, y, 'k'], [x, y + 1, 'R'], [x, y + 2, 'f'], [x, y + 3, 't'], [x, y + 4, 'R'], [x, y + 5, 'k']]);
  }
  return plot(r, [[1, 6, 'k'], [1, 7, 'k'], [1, 8, 'k'], [14, 6, 'k'], [14, 7, 'k'], [14, 8, 'k']]);
})();

// 웨지감자: 껍질 붙은 반달 세 조각
export const WEDGES = (() => {
  let r = blank(16, 16);
  const wedge = (x0, y0) => {
    for (let i = 0; i < 5; i++) r = rect(r, x0 + i, y0 + i, 6 - i, 1, i === 0 ? 'B' : 'b');
    r = plot(r, [[x0 + 1, y0 + 1, 'y']]);
  };
  wedge(1, 3);
  wedge(8, 5);
  wedge(4, 9);
  // 테두리: 칠한 칸 바깥쪽
  const out = r.map((s) => [...s]);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (r[y][x] !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (r[y + dy]?.[x + dx] ?? '.') !== '.' && (r[y + dy]?.[x + dx] ?? '.') !== 'k')) out[y][x] = 'k';
    }
  }
  return out.map((s) => s.join(''));
})();

// ── 기계 ──

// 훈연기: 검푸른 장 + 굴뚝, 가동 중엔 연기가 오른다
export const SMOKER = frames3((f) => {
  let r = box(4);
  r = rect(r, 2, 4, 10, 9, 'w');
  r = frame(r, 2, 4, 10, 9, 'k');
  r = rect(r, 4, 6, 6, 2, 'R');
  r = rect(r, 4, 9, 6, 2, 'm');
  r = rect(r, 12, 1, 2, 6, '2');
  r = frame(r, 12, 1, 2, 6, 'k');
  if (f) r = plot(r, [[12 + (f % 2), 0, '3'], [13 - (f % 2), 0, '3']]);
  return plot(r, [[3, 13, 'y'], [11, 13, 'o']]);
});

// ── M17 부산물과 순환 ──

// 폐식용유: 거무스름한 기름통
export const USED_OIL = (() => {
  let r = blank(16, 16);
  r = rect(r, 4, 3, 8, 11, 'd');
  r = rect(r, 5, 4, 2, 4, 'B');
  r = frame(r, 4, 3, 8, 11, 'k');
  r = rect(r, 6, 1, 4, 2, '1');
  r = frame(r, 6, 1, 4, 2, 'k');
  r = plot(r, [[8, 9, 'K'], [9, 10, 'K'], [7, 11, 'K']]);
  return rect(r, 5, 14, 8, 1, 'K');
})();

// 바이오 연료: 초록 연료통 + 노란 띠
export const BIO_FUEL = (() => {
  let r = blank(16, 16);
  r = rect(r, 3, 3, 10, 11, 'G');
  r = rect(r, 3, 7, 10, 2, 'y');
  r = rect(r, 4, 4, 2, 2, 'g');
  r = frame(r, 3, 3, 10, 11, 'k');
  r = rect(r, 9, 1, 3, 2, '2');
  r = frame(r, 9, 1, 3, 2, 'k');
  return rect(r, 4, 14, 10, 1, 'K');
})();

/** 칠한 칸 바깥에 검은 테두리를 두른다 */
function outline(rows) {
  const out = rows.map((x) => [...x]);
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (rows[y + dy]?.[x + dx] ?? '.') !== '.')) out[y][x] = 'k';
    }
  }
  return out.map((x) => x.join(''));
}

// 감자 껍질: 두껍게 말린 갈색 껍질 두 가닥
export const PEEL = (() => {
  let r = blank(16, 16);
  const curl = (cx, cy, turn) => {
    for (let t = 0; t < turn; t += 0.12) {
      const rad = 0.8 + t * 0.55;
      const x = Math.round(cx + Math.cos(t) * rad);
      const y = Math.round(cy + Math.sin(t) * rad);
      r = plot(r, [[x, y, t > turn * 0.6 ? 'B' : 'b'], [x + 1, y, 'b']]);
    }
  };
  curl(5, 5, 6);
  curl(10, 10, 5.5);
  return outline(r);
})();

// 비료: 포대 + 새싹
export const FERTILIZER = (() => {
  let r = blank(16, 16);
  r = rect(r, 3, 4, 10, 10, 'F');
  r = rect(r, 4, 5, 8, 2, 'f');
  r = frame(r, 3, 4, 10, 10, 'k');
  r = plot(r, [[7, 9, 'g'], [8, 9, 'g'], [8, 10, 'G'], [8, 11, 'G'], [9, 8, 'g'], [6, 8, 'g']]);
  r = plot(r, [[4, 3, 'k'], [11, 3, 'k'], [5, 3, 'F'], [10, 3, 'F']]);
  return rect(r, 4, 14, 10, 1, 'K');
})();

// 폐유 정제기: 통 두 개 + 이어진 관, 가동 중엔 방울이 떨어진다
export const REFINER = frames3((f) => {
  let r = box(6);
  r = rect(r, 1, 2, 5, 9, 'd');
  r = frame(r, 1, 2, 5, 9, 'k');
  r = rect(r, 10, 4, 5, 7, 'G');
  r = frame(r, 10, 4, 5, 7, 'k');
  r = rect(r, 6, 4, 4, 1, '3');
  r = rect(r, 6, 5, 4, 1, 'k');
  if (f) r = plot(r, [[12, 2 + f, 'g']]);
  return plot(r, [[3, 13, 'y'], [12, 13, 'G']]);
});

// 퇴비통: 나무 상자 + 위로 삐져나온 새싹
export const COMPOST_BIN = frames3((f) => {
  let r = box(7);
  r = rect(r, 2, 3, 12, 9, 'B');
  for (let y = 5; y < 12; y += 3) r = rect(r, 2, y, 12, 1, 'm');
  r = frame(r, 2, 3, 12, 9, 'k');
  r = rect(r, 3, 4, 10, 1, 'd');
  r = plot(r, [[5, 2, 'g'], [6, 1 + (f % 2), 'G'], [10, 2, 'g'], [11, 2 - (f === 2 ? 1 : 0), 'g']]);
  return plot(r, [[3, 13, 'y'], [12, 13, 'g']]);
});
