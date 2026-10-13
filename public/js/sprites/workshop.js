// M6 도트: 원료·부품·새 메뉴 아이템, 부품 공방 기계, 발전기, 새 메뉴 기계, 잠긴 구역 바닥
import { blank, plot, rect, frame } from './draw.js';

// ── 아이템 (16x16, 가운데 쪽에 작게) ──

/** 둥근 덩어리: 가운데 (cx,cy), 반지름 r, 본색/어두운 면/하이라이트 */
function lump(cx, cy, r, body, dark, hi) {
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

export const IRON_ORE = plot(lump(8, 9, 5.5, 'd', 'm', '2'), [[6, 9, 'r'], [10, 8, 'r'], [9, 11, '2'], [5, 11, 'r']]);
export const COAL = plot(lump(8, 9, 5, 'K', 'K', '1'), [[9, 10, '1'], [6, 11, '1']]);
export const POTATO = plot(lump(8, 9, 5, 'b', 'B', 'o'), [[6, 10, 'd'], [10, 8, 'd'], [9, 11, 'd']]);

export const IRON_INGOT = (() => {
  let r = blank(16, 16);
  r = rect(r, 2, 7, 12, 5, '2');
  r = rect(r, 4, 5, 8, 2, '3');
  r = frame(r, 2, 7, 12, 5, 'k');
  r = plot(r, [[3, 6, 'k'], [12, 6, 'k'], [4, 5, 'k'], [11, 5, 'k'], [3, 8, '3'], [4, 8, '3']]);
  r = rect(r, 3, 12, 12, 1, 'K');
  return r;
})();

// 철선: 감긴 실타래
export const WIRE = (() => {
  let r = blank(16, 16);
  for (let i = 0; i < 4; i++) r = frame(r, 3 + i, 4 + i, 10 - i * 2, 9 - i * 2, i % 2 ? '2' : '3');
  r = frame(r, 2, 3, 12, 11, 'k');
  r = plot(r, [[13, 13, '3'], [14, 14, '3'], [14, 13, 'k']]);
  return r;
})();

// 모터: 원통 몸통 + 축 + 노란 띠
export const MOTOR = (() => {
  let r = blank(16, 16);
  r = rect(r, 2, 4, 10, 9, '1');
  r = rect(r, 3, 5, 8, 2, '2');
  r = rect(r, 6, 4, 2, 9, 'y');
  r = frame(r, 2, 4, 10, 9, 'k');
  r = rect(r, 12, 7, 3, 3, '3');
  r = frame(r, 12, 7, 3, 3, 'k');
  r = rect(r, 3, 13, 10, 1, 'K');
  return r;
})();

export const POTATO_STICK = (() => {
  let r = blank(16, 16);
  for (const [x, y] of [[3, 5], [6, 4], [9, 6], [5, 8], [10, 9]]) {
    r = rect(r, x, y, 2, 5, 'c');
    r = plot(r, [[x + 1, y + 4, 'b'], [x, y, 'l']]);
  }
  return r;
})();

// 감자튀김: 빨간 종이 상자에 노란 막대
export const FRIES = (() => {
  let r = blank(16, 16);
  for (const x of [4, 6, 8, 10]) r = rect(r, x, 2 + (x % 3), 2, 6, 'c');
  r = plot(r, [[5, 3, 'o'], [9, 4, 'o'], [7, 2, 'l']]);
  r = rect(r, 3, 7, 10, 7, 't');
  r = frame(r, 3, 7, 10, 7, 'k');
  r = plot(r, [[7, 9, 'y'], [8, 9, 'y'], [7, 10, 'y'], [8, 10, 'y']]);
  r = rect(r, 4, 14, 10, 1, 'K');
  return r;
})();

// 콜라: 빨대 꽂힌 컵
export const COLA = (() => {
  let r = blank(16, 16);
  r = rect(r, 4, 4, 8, 10, 't');
  r = rect(r, 5, 4, 6, 2, 'l');
  r = rect(r, 5, 8, 6, 2, 'l');
  r = frame(r, 4, 4, 8, 10, 'k');
  r = plot(r, [[9, 1, 'y'], [9, 2, 'y'], [9, 3, 'y'], [10, 0, 'y'], [5, 13, 'R'], [10, 12, 'R']]);
  r = rect(r, 5, 14, 8, 1, 'K');
  return r;
})();

// 탄산 시럽: 갈색 병
export const SYRUP = (() => {
  let r = blank(16, 16);
  r = rect(r, 6, 2, 4, 3, 'k');
  r = rect(r, 7, 3, 2, 2, 'B');
  r = rect(r, 4, 5, 8, 9, 'm');
  r = rect(r, 5, 8, 6, 3, 'l');
  r = frame(r, 4, 5, 8, 9, 'k');
  r = plot(r, [[6, 9, 't'], [7, 9, 't'], [8, 9, 't'], [5, 6, 'M']]);
  return r;
})();

// 물: 물방울
export const WATER = (() => {
  let r = lump(8, 10, 4.5, 'p', 'P', '3');
  return plot(r, [[8, 3, 'k'], [8, 4, 'p'], [7, 5, 'k'], [9, 5, 'k'], [8, 5, 'p'], [7, 6, 'p'], [9, 6, 'p']]);
})();

// 세트: 쟁반 위 버거·감자튀김·컵
export const SET_MEAL = (() => {
  let r = blank(16, 16);
  r = rect(r, 1, 11, 14, 3, 'f');
  r = frame(r, 1, 11, 14, 3, 'k');
  r = rect(r, 2, 7, 6, 4, 'b'); // 버거
  r = rect(r, 2, 9, 6, 1, 'm');
  r = rect(r, 2, 8, 6, 1, 'g');
  r = frame(r, 2, 6, 6, 5, 'k');
  r = rect(r, 9, 6, 2, 3, 'c'); // 감자튀김
  r = rect(r, 8, 8, 4, 3, 't');
  r = rect(r, 12, 5, 3, 6, 't'); // 컵
  r = frame(r, 12, 5, 3, 6, 'k');
  r = plot(r, [[13, 3, 'y'], [13, 4, 'y']]);
  return r;
})();

// ── 기계 ──

/** 공통 철제 상자 (가동 중 깜박일 자리 lamp 는 world.js 가 그린다) */
function box(top = 3) {
  let r = blank(16, 16);
  r = rect(r, 0, top, 16, 15 - top, '1');
  r = rect(r, 1, top + 1, 14, 1, '2');
  r = frame(r, 0, top, 16, 15 - top, 'k');
  r = rect(r, 1, 15, 15, 1, 'K');
  return r;
}
const frames3 = (make) => [0, 1, 2].map(make);

// 제련로: 벽돌 굴뚝 + 시뻘건 입구
export const SMELTER = frames3((f) => {
  let r = box(5);
  r = rect(r, 9, 0, 5, 6, 'r');
  r = frame(r, 9, 0, 5, 6, 'k');
  r = rect(r, 3, 8, 7, 5, 'K');
  r = frame(r, 3, 8, 7, 5, 'k');
  if (f) r = plot(r, [[5, 11, 'o'], [6, 10, 'y'], [7, 11, 'o'], [4, 12, 'r'], [8, 12, 'r'], [5 + f, 9, 'o']]);
  return plot(r, [[11, 0, f ? '3' : 'k'], [12, 1, '2']]);
});

// 프레스: 위에서 내려찍는 망치
export const PRESS = frames3((f) => {
  let r = box(9);
  r = rect(r, 1, 0, 2, 10, '2');
  r = rect(r, 13, 0, 2, 10, '2');
  r = rect(r, 1, 0, 14, 2, '1');
  r = frame(r, 1, 0, 14, 2, 'k');
  const hy = [3, 6, 4][f];
  r = rect(r, 4, hy, 8, 3, '3');
  r = frame(r, 4, hy, 8, 3, 'k');
  r = rect(r, 7, 2, 2, hy - 2, '2');
  return plot(r, [[3, 12, 'y'], [4, 12, 'K'], [5, 12, 'y']]);
});

// 와이어 머신: 감긴 실패 두 개
export const WIRE_MACHINE = frames3((f) => {
  let r = box(6);
  for (const cx of [4, 11]) {
    r = rect(r, cx - 3, 1, 6, 6, '3');
    r = frame(r, cx - 3, 1, 6, 6, 'k');
    r = plot(r, [[cx - 1 + (f % 2), 3, 'K'], [cx, 4, '2']]);
  }
  return plot(r, [[7, 4, '2'], [8, 4, '2'], [3, 11, 'y'], [12, 12, 'd']]);
});

// 기어 선반: 큰 톱니바퀴가 옆에
export const GEAR_LATHE = frames3((f) => {
  let r = box(6);
  r = rect(r, 3, 0, 9, 9, '2');
  r = frame(r, 3, 0, 9, 9, 'k');
  r = rect(r, 6, 3, 3, 3, 'K');
  const teeth = [[[7, 0], [11, 4], [7, 8], [3, 4]], [[4, 1], [10, 1], [10, 7], [4, 7]], [[7, 0], [11, 4], [7, 8], [3, 4]]][f];
  r = plot(r, teeth.map(([x, y]) => [x, y, '3']));
  return plot(r, [[12, 11, 'y'], [2, 12, 'd']]);
});

// 부품 조립기: 로봇 팔 하나가 작업판 위로
export const PART_ASSEMBLER = frames3((f) => {
  let r = box(7);
  r = rect(r, 2, 9, 12, 4, 'K');
  r = frame(r, 2, 9, 12, 4, 'k');
  const ax = [4, 8, 6][f];
  r = rect(r, 12, 0, 2, 8, '2');
  r = rect(r, ax, 1, 12 - ax, 2, 'o');
  r = rect(r, ax, 3, 2, 4, 'o');
  r = plot(r, [[ax - 1, 7, 'y'], [ax + 2, 7, 'y'], [ax, 7, 'k'], [ax + 1, 7, 'k']]);
  return plot(r, [[4, 11, '3'], [10, 11, 'y']]);
});

// 발전기 (2x2): 큰 몸통, 배기구, 앞 계기판
export const GENERATOR = frames3((f) => {
  let r = blank(32, 32);
  r = rect(r, 1, 6, 30, 24, '1');
  r = rect(r, 2, 7, 28, 1, '2');
  r = frame(r, 1, 6, 30, 24, 'k');
  r = rect(r, 2, 31, 30, 1, 'K');
  r = rect(r, 4, 0, 5, 7, '2'); // 배기구
  r = frame(r, 4, 0, 5, 7, 'k');
  if (f) r = plot(r, [[5 + f, 0, '3'], [6, 1, '3']]);
  r = rect(r, 18, 10, 10, 8, 'K'); // 계기판
  r = frame(r, 18, 10, 10, 8, 'k');
  const needle = [[22, 13], [23, 12], [24, 12]][f];
  r = plot(r, [[21, 15, 'y'], [22, 14, 'y'], needle.concat('y'), [20, 16, 'G'], [26, 16, 'R']]);
  // 경고 빗금, 석탄 넣는 구멍
  for (let x = 3; x < 29; x++) r = plot(r, [[x, 27, (x + 1) % 4 < 2 ? 'y' : 'K']]);
  r = rect(r, 4, 12, 9, 6, 'K');
  r = frame(r, 4, 12, 9, 6, 'k');
  if (f) r = plot(r, [[6, 15, 'r'], [8, 16, 'o'], [10, 15, 'r']]);
  return plot(r, [[14, 22, '3'], [29, 9, '3'], [3, 24, 'd']]);
});

// 감자 절단기: 칼날 격자가 위에
export const POTATO_CUTTER = frames3((f) => {
  let r = box(6);
  r = rect(r, 3, 1, 10, 6, '3');
  for (let x = 4; x < 13; x += 2) r = rect(r, x, 1 + (f === 1 ? 1 : 0), 1, 5, '2');
  r = frame(r, 3, 1, 10, 6, 'k');
  return plot(r, [[5, 11, 'c'], [6, 11, 'c'], [10, 12, 'd']]);
});

// 튀김기: 기름 통 + 바구니 손잡이
export const FRYER = frames3((f) => {
  let r = box(4);
  r = rect(r, 2, 6, 12, 6, 'd');
  r = frame(r, 2, 6, 12, 6, 'k');
  if (f) r = plot(r, [[4 + f, 8, 'y'], [9, 9 - (f % 2), 'y'], [11, 8, 'o'], [6, 10, 'o']]);
  r = rect(r, 6, 0, 4, 1, '3');
  r = rect(r, 7, 1, 2, 5, '3');
  return plot(r, [[3, 13, 'r'], [4, 13, 'r']]);
});

// 탄산 믹서: 투명 통에 거품
export const SODA_MIXER = frames3((f) => {
  let r = box(8);
  r = rect(r, 4, 0, 8, 9, 'p');
  r = frame(r, 4, 0, 8, 9, 'k');
  r = rect(r, 5, 4, 6, 4, 'm');
  if (f) r = plot(r, [[6, 3 - (f % 2), '3'], [9, 2 + (f % 2), '3'], [7, 1, '3']]);
  return plot(r, [[13, 10, 'y'], [2, 12, 'd']]);
});

// 포장기 (2x1): 상자 접는 컨베이어 + 위에 종이 상자
export const PACKER = frames3((f) => {
  let r = blank(32, 16);
  r = rect(r, 0, 5, 32, 10, '1');
  r = rect(r, 1, 6, 30, 1, '2');
  r = frame(r, 0, 5, 32, 10, 'k');
  r = rect(r, 1, 15, 31, 1, 'K');
  r = rect(r, 3, 9, 26, 3, 'K');
  for (let x = 3 + f; x < 29; x += 3) r = plot(r, [[x, 10, '1']]);
  r = rect(r, 12, 0, 9, 7, 'f'); // 종이 상자
  r = frame(r, 12, 0, 9, 7, 'k');
  r = plot(r, [[16, 0, 'k'], [16, 1, 'k'], [15, 3, 't'], [16, 3, 't'], [17, 3, 't']]);
  return plot(r, [[4, 13, 'y'], [5, 13, 'K'], [6, 13, 'y'], [27, 6, 'd']]);
});

// 감자밭: 흙 위에 둥근 잎 → 다 자라면 흙 위로 감자가 보인다
export { FIELD_POTATO } from './farm-potato.js';

// 잠긴 구역 바닥: 어두운 콘크리트 + 공사 빗금
export const LOCKED = (() => {
  let r = blank(16, 16);
  r = rect(r, 0, 0, 16, 16, 'K');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 8 === 0) r = plot(r, [[x, y, 'w']]);
  return plot(r, [[3, 12, '1'], [11, 4, '1']]);
})();
