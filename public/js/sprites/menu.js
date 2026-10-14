// M9 도트: 피자·치킨·핫도그·아이스크림 재료와 기계, 토마토밭, 냉동 유닛
import { blank, plot, rect, frame } from './draw.js';

// ── 아이템 (16x16) ──

/** 둥근 덩어리 (workshop.js 와 같은 방식) */
export function lump(cx, cy, r, body, dark, hi) {
  let s = blank(16, 16);
  const pts = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.2);
      if (d <= r - 1) pts.push([x, y, x + y > cx + cy + 2 ? dark : body]);
      else if (d <= r) pts.push([x, y, 'k']);
    }
  }
  s = plot(s, pts);
  return plot(s, [[cx - 2, cy - 2, hi], [cx - 1, cy - 2, hi], [cx - 2, cy - 1, hi]]);
}

export const TOMATO = plot(lump(8, 9, 5, 't', 'R', 'l'), [[7, 3, 'g'], [8, 3, 'g'], [9, 3, 'g'], [8, 4, 'G'], [6, 4, 'g'], [10, 4, 'g']]);

// 토마토 소스: 빨간 단지
export const TOMATO_SAUCE = (() => {
  let r = blank(16, 16);
  r = rect(r, 4, 5, 8, 9, 't');
  r = rect(r, 5, 6, 2, 3, 'o');
  r = frame(r, 4, 5, 8, 9, 'k');
  r = rect(r, 5, 3, 6, 2, 'f');
  r = frame(r, 5, 3, 6, 2, 'k');
  r = plot(r, [[9, 11, 'R'], [10, 10, 'R']]);
  return rect(r, 5, 14, 8, 1, 'K');
})();

// 우유: 하얀 병
export const MILK = (() => {
  let r = blank(16, 16);
  r = rect(r, 6, 1, 4, 3, 'p');
  r = frame(r, 6, 1, 4, 3, 'k');
  r = rect(r, 4, 4, 8, 10, 'l');
  r = rect(r, 5, 8, 6, 3, 'p');
  r = frame(r, 4, 4, 8, 10, 'k');
  r = plot(r, [[5, 5, 'f'], [10, 12, 'f']]);
  return rect(r, 5, 14, 8, 1, 'K');
})();

// 치즈: 구멍 뚫린 쐐기
export const CHEESE = (() => {
  let r = blank(16, 16);
  for (let y = 0; y < 8; y++) r = rect(r, 2, 5 + y, 3 + y + 5, 1, 'c');
  r = rect(r, 2, 12, 12, 1, 'y');
  r = plot(r, [[4, 9, 'y'], [7, 10, 'y'], [9, 8, 'y'], [5, 7, 'y'], [11, 11, 'y']]);
  r = frame(r, 2, 5, 12, 8, 'k');
  for (let y = 0; y < 7; y++) r = plot(r, [[2 + 3 + y + 5, 5 + y, 'k']]);
  return rect(r, 3, 13, 12, 1, 'K');
})();

// 피자: 둥근 도우 + 소스 + 치즈 + 페퍼로니
export const PIZZA = (() => {
  let r = lump(8, 8, 6.5, 'b', 'B', 'o');
  const pts = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 8, (y - 8) * 1.2);
    if (d <= 4.6) pts.push([x, y, 'c']);
    if (d <= 4.6 && d > 3.8) pts.push([x, y, 't']);
  }
  r = plot(r, pts);
  return plot(r, [[6, 7, 'R'], [7, 7, 'R'], [10, 8, 'R'], [10, 9, 'R'], [7, 10, 'R'], [8, 10, 'R'], [9, 6, 'g']]);
})();

// 생닭: 분홍빛 다리
export const RAW_CHICKEN = (() => {
  let r = lump(7, 8, 5, 's', 'S', 'l');
  r = rect(r, 11, 10, 3, 2, 'l');
  r = frame(r, 11, 10, 3, 2, 'k');
  return plot(r, [[14, 9, 'k'], [14, 12, 'k']]);
})();

// 염지 닭: 물기 머금은 다리
export const BRINED_CHICKEN = plot(RAW_CHICKEN, [[5, 6, 'p'], [8, 10, 'p'], [4, 9, '3']]);

// 치킨: 바삭한 갈색 다리
export const FRIED_CHICKEN = (() => {
  let r = lump(7, 8, 5.5, 'b', 'B', 'c');
  r = plot(r, [[5, 9, 'M'], [8, 7, 'M'], [6, 11, 'M'], [9, 10, 'o']]);
  r = rect(r, 11, 10, 3, 2, 'l');
  r = frame(r, 11, 10, 3, 2, 'k');
  return plot(r, [[14, 9, 'k'], [14, 12, 'k']]);
})();

// 소시지: 길쭉한 갈색 막대
export const SAUSAGE = (() => {
  let r = blank(16, 16);
  r = rect(r, 3, 7, 10, 3, 'M');
  r = rect(r, 4, 7, 8, 1, 'o');
  r = frame(r, 2, 6, 12, 5, 'k');
  r = plot(r, [[2, 6, '.'], [13, 6, '.'], [2, 10, '.'], [13, 10, '.'], [2, 8, 'm'], [13, 8, 'm']]);
  return rect(r, 3, 11, 10, 1, 'K');
})();

// 핫도그: 번 사이 소시지 + 머스터드
export const HOTDOG = (() => {
  let r = blank(16, 16);
  r = rect(r, 1, 8, 14, 4, 'b');
  r = rect(r, 2, 11, 12, 1, 'B');
  r = rect(r, 2, 6, 12, 3, 'M');
  r = plot(r, [[3, 7, 'c'], [5, 6, 'c'], [7, 7, 'c'], [9, 6, 'c'], [11, 7, 'c']]);
  r = frame(r, 1, 6, 14, 7, 'k');
  return rect(r, 2, 13, 13, 1, 'K');
})();

// 아이스크림: 콘 위 두 덩이
export const ICE_CREAM = (() => {
  let r = blank(16, 16);
  for (let y = 0; y < 7; y++) r = rect(r, 5 + Math.floor(y / 2), 8 + y, 6 - Math.floor(y / 2) * 2, 1, y % 2 ? 'B' : 'b');
  r = plot(r, [[7, 15, 'k'], [8, 15, 'k']]);
  r = plot(lump(8, 6, 4, 'l', 'f', 'l'), []).map((row, y) => (y < 9 ? row : r[y]));
  r = plot(r, [[6, 5, 't'], [9, 4, 'p'], [8, 7, 'c']]);
  return r;
})();

// 냉동 유닛 (부품): 냉각 핀 달린 상자
export const COOLING_UNIT = (() => {
  let r = blank(16, 16);
  r = rect(r, 2, 4, 12, 9, 'p');
  r = frame(r, 2, 4, 12, 9, 'k');
  for (let x = 4; x < 13; x += 2) r = rect(r, x, 5, 1, 7, '3');
  r = plot(r, [[3, 3, 'k'], [12, 3, 'k'], [7, 2, 'l'], [8, 2, 'l']]);
  return rect(r, 3, 13, 12, 1, 'K');
})();

// ── 기계 ──

export function box(top = 3, w = 16) {
  let r = blank(w, 16);
  r = rect(r, 0, top, w, 15 - top, '1');
  r = rect(r, 1, top + 1, w - 2, 1, '2');
  r = frame(r, 0, top, w, 15 - top, 'k');
  r = rect(r, 1, 15, w - 1, 1, 'K');
  return r;
}
export const frames3 = (make) => [0, 1, 2].map(make);

// 소스 냄비: 끓는 빨간 냄비
export const SAUCE_POT = frames3((f) => {
  let r = box(8);
  r = rect(r, 3, 3, 10, 7, '2');
  r = frame(r, 3, 3, 10, 7, 'k');
  r = rect(r, 4, 4, 8, 2, 't');
  if (f) r = plot(r, [[5 + f, 3, 'o'], [9, 2 - (f % 2), 'l'], [6, 1, 'l']]);
  return plot(r, [[1, 5, 'k'], [2, 5, '2'], [14, 5, 'k'], [13, 5, '2'], [3, 12, 'r'], [4, 12, 'o']]);
});

// 치즈 통: 하얀 통 + 젓는 막대
export const CHEESE_VAT = frames3((f) => {
  let r = box(7);
  r = rect(r, 2, 2, 12, 8, 'l');
  r = frame(r, 2, 2, 12, 8, 'k');
  r = rect(r, 3, 3, 10, 2, 'c');
  r = rect(r, 6 + f, 0, 1, 6, '3');
  return plot(r, [[3, 12, 'y'], [12, 12, 'p']]);
});

// 피자 오븐 (2x1): 벽돌 아치 + 안에 불
export const PIZZA_OVEN = frames3((f) => {
  let r = box(4, 32);
  r = rect(r, 6, 0, 20, 10, 'r');
  for (let y = 1; y < 10; y += 3) r = rect(r, 6, y, 20, 1, 'B');
  r = frame(r, 6, 0, 20, 10, 'k');
  r = rect(r, 11, 4, 10, 6, 'K');
  r = frame(r, 11, 4, 10, 6, 'k');
  if (f) r = plot(r, [[13, 8, 'o'], [15, 7 + (f % 2), 'y'], [17, 8, 'o'], [19, 8, 'r'], [14, 9, 'r']]);
  return plot(r, [[3, 12, 'y'], [28, 12, 'y'], [27, 6, 'c'], [4, 6, 'b']]);
});

// 염지통: 파란 물통 + 거품
export const BRINE_TANK = frames3((f) => {
  let r = box(9);
  r = rect(r, 3, 1, 10, 10, 'P');
  r = rect(r, 4, 3, 8, 6, 'p');
  r = frame(r, 3, 1, 10, 10, 'k');
  if (f) r = plot(r, [[5 + f, 4, '3'], [9, 6 - (f % 2), '3']]);
  return plot(r, [[6, 7, 's'], [7, 7, 's'], [3, 12, 'y']]);
});

// 치킨 튀김기: 기름통 + 바구니
export const CHICKEN_FRYER = frames3((f) => {
  let r = box(4);
  r = rect(r, 2, 6, 12, 6, 'd');
  r = frame(r, 2, 6, 12, 6, 'k');
  r = rect(r, 4, 2 + (f === 2 ? 1 : 0), 8, 5, '3');
  r = frame(r, 4, 2 + (f === 2 ? 1 : 0), 8, 5, 'k');
  if (f) r = plot(r, [[3 + f, 8, 'y'], [10, 9, 'o'], [7, 10, 'y']]);
  return plot(r, [[6, 4, 'b'], [8, 4, 'B'], [3, 13, 'r'], [12, 13, 'r']]);
});

// 소시지 기계: 깔때기 + 나오는 소시지
export const SAUSAGE_MAKER = frames3((f) => {
  let r = box(6);
  r = rect(r, 2, 0, 8, 4, '3');
  r = rect(r, 4, 4, 4, 3, '2');
  r = frame(r, 2, 0, 8, 4, 'k');
  r = rect(r, 3, 1, 6, 1, 'M');
  r = rect(r, 10, 9, 5 - (f % 2), 2, 'M');
  r = frame(r, 10, 9, 5 - (f % 2), 2, 'k');
  return plot(r, [[3, 12, 'y'], [4, 12, 'K'], [5, 12, 'y']]);
});

// 핫도그 조립기 (2x1): 벨트 위 번과 소시지
export const HOTDOG_ASSEMBLER = frames3((f) => {
  let r = box(5, 32);
  r = rect(r, 3, 9, 26, 3, 'K');
  for (let x = 3 + f; x < 29; x += 3) r = plot(r, [[x, 10, '1']]);
  r = rect(r, 8, 6, 8, 3, 'b');
  r = rect(r, 9, 5, 6, 2, 'M');
  r = frame(r, 8, 5, 8, 4, 'k');
  r = rect(r, 20, 0, 6, 6, '3');
  r = frame(r, 20, 0, 6, 6, 'k');
  r = plot(r, [[22, 6 + (f % 2), 'c'], [23, 6 + (f % 2), 'c']]);
  return plot(r, [[3, 13, 'y'], [28, 13, 'y']]);
});

// 냉동고 (2x1): 하얀 상자, 유리 뚜껑 안에 아이스크림 통, 냉기
export const FREEZER = frames3((f) => {
  let r = box(3, 32);
  r = rect(r, 1, 4, 30, 10, 'l');
  r = frame(r, 0, 3, 32, 12, 'k');
  r = rect(r, 3, 5, 26, 5, 'p');
  r = frame(r, 3, 5, 26, 5, 'k');
  for (const x of [6, 13, 20]) r = rect(r, x, 6, 5, 3, ['c', 't', 'f'][(x / 7 + f) % 3 | 0]);
  if (f) r = plot(r, [[5 + f * 6, 1, '3'], [8 + f * 5, 0, '3'], [22, 2 - (f % 2), '3']]);
  return plot(r, [[4, 12, 'P'], [5, 12, 'P'], [27, 12, 'G']]);
});

// 토마토밭 (2x2, 4프레임)
function plot2x2() {
  let r = blank(32, 32);
  r = rect(r, 0, 0, 32, 31, 'd');
  for (let y = 4; y < 30; y += 7) r = rect(r, 2, y + 3, 28, 1, 'm');
  r = frame(r, 0, 0, 32, 31, 'B');
  r = frame(r, 1, 1, 30, 29, 'b');
  r = rect(r, 1, 31, 31, 1, 'K');
  return plot(r, [[0, 0, 'k'], [31, 0, 'k'], [0, 30, 'k'], [31, 30, 'k'], [12, 0, 'k'], [20, 30, 'k']]);
}

export const FIELD_TOMATO = [0, 1, 2, 3].map((stage) => {
  let r = plot2x2();
  [5, 12, 19, 26].forEach((y, j) => [6, 13, 20, 26].forEach((x0) => {
    const x = x0 - (j % 2);
    if (stage === 0) r = plot(r, [[x, y + 1, 'g']]);
    else if (stage === 1) r = plot(r, [[x, y, 'g'], [x, y + 1, 'G']]);
    else if (stage === 2) r = plot(r, [[x, y - 2, 'g'], [x - 1, y - 1, 'g'], [x + 1, y - 1, 'g'], [x, y, 'G'], [x, y + 1, 'G']]);
    else r = plot(r, [[x, y - 2, 'g'], [x - 1, y - 1, 'G'], [x + 1, y - 1, 'G'], [x - 1, y, 't'], [x, y, 't'], [x, y + 1, 'R'], [x + 1, y + 1, 't']]);
  }));
  return r;
});
