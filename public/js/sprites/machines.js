// 작업대/기계 도트. 1칸 = 16x16, 2x1 기계 = 32x16.
import { blank, plot, rect, frame } from './draw.js';

// 공통: 철제 작업대 상판 (밝은 위쪽 모서리, 어두운 아래쪽, 바닥에 떨어지는 hard shadow)
function steelTop(w, h) {
  let r = blank(w, h);
  r = rect(r, 0, 0, w, h - 1, '2');
  r = rect(r, 1, 1, w - 2, 1, '3');
  r = rect(r, 1, h - 3, w - 2, 1, '1');
  r = frame(r, 0, 0, w, h - 1, 'k');
  r = rect(r, 1, h - 1, w - 1, 1, 'K');
  return r;
}

// 도마: 철제 받침 위 나무 도마, 칼 하나
export const CUTTING_BOARD = (() => {
  let r = steelTop(16, 16);
  r = rect(r, 3, 3, 10, 9, 'b');
  r = frame(r, 3, 3, 10, 9, 'k');
  r = rect(r, 4, 10, 8, 1, 'B');
  r = plot(r, [[5, 5, 'B'], [6, 5, 'B'], [9, 7, 'B'], [7, 8, 'B'], [10, 5, 'B']]);
  // 칼 (손잡이 기름때 갈색, 날 금속 밝음)
  r = plot(r, [[12, 4, '3'], [12, 5, '3'], [12, 6, '3'], [13, 5, '3'], [13, 6, '3'], [12, 7, 'd'], [12, 8, 'd'], [13, 7, 'k']]);
  r = plot(r, [[2, 13, 'd'], [3, 13, 'd']]); // 기름 얼룩
  return r;
})();

// 수동 철판: 검게 그을린 철판, 앞쪽 손잡이 두 개
const GRIDDLE_BASE = (() => {
  let r = steelTop(16, 16);
  r = rect(r, 2, 2, 12, 9, '1');
  r = frame(r, 2, 2, 12, 9, 'K');
  r = plot(r, [[4, 4, 'd'], [9, 5, 'd'], [6, 7, 'd'], [11, 8, 'd'], [5, 9, 'd']]);
  r = plot(r, [[3, 12, 'r'], [4, 12, 'r'], [11, 12, 'o'], [12, 12, 'o']]);
  return r;
})();

const HEAT_A = [[4, 6, 'r'], [7, 4, 'r'], [10, 7, 'r'], [6, 9, 'r'], [5, 3, '3'], [6, 2, '3'], [10, 3, '3']];
const HEAT_B = [[5, 6, 'r'], [8, 5, 'r'], [9, 8, 'r'], [7, 9, 'r'], [6, 3, '3'], [5, 1, '3'], [11, 2, '3']];

// 0 = 꺼짐, 1~2 = 굽는 중 (열기 + 연기)
export const GRIDDLE = [GRIDDLE_BASE, plot(GRIDDLE_BASE, HEAT_A), plot(GRIDDLE_BASE, HEAT_B)];

// 조립대: 넓은 철제 상판, 재료 놓는 자리 표시(경고 노랑 모서리) 3곳
export const ASSEMBLY_TABLE = (() => {
  let r = steelTop(32, 16);
  for (const sx of [3, 12, 21]) {
    r = plot(r, [
      [sx, 4, 'y'], [sx + 1, 4, 'y'], [sx, 5, 'y'],
      [sx + 7, 4, 'y'], [sx + 6, 4, 'y'], [sx + 7, 5, 'y'],
      [sx, 11, 'y'], [sx, 10, 'y'], [sx + 1, 11, 'y'],
      [sx + 7, 11, 'y'], [sx + 7, 10, 'y'], [sx + 6, 11, 'y'],
    ]);
  }
  r = plot(r, [[2, 2, '1'], [29, 2, '1'], [2, 11, '1'], [29, 12, '1']]); // 리벳 (위치 일부러 어긋남)
  r = plot(r, [[17, 13, 'd'], [18, 13, 'd'], [18, 12, 'd']]);
  return r;
})();

// 출고구: 판매대 상판 + 앞쪽 경고 빗금 + 호출 벨
export const COUNTER = (() => {
  let r = blank(32, 16);
  r = rect(r, 0, 0, 32, 9, 'f');
  r = rect(r, 1, 1, 30, 1, 'l');
  r = frame(r, 0, 0, 32, 9, 'k');
  for (let x = 0; x < 32; x++) {
    for (let y = 9; y < 14; y++) r = plot(r, [[x, y, (x + y) % 6 < 3 ? 'y' : 'K']]);
  }
  r = frame(r, 0, 8, 32, 7, 'k');
  r = rect(r, 1, 15, 31, 1, 'K');
  // 호출 벨
  r = plot(r, [
    [24, 3, 'k'], [25, 2, 'k'], [26, 2, 'k'], [27, 3, 'k'],
    [24, 4, 'o'], [25, 3, 'y'], [26, 3, 'y'], [27, 4, 'o'], [25, 4, 'y'], [26, 4, 'o'],
    [23, 5, 'k'], [24, 5, 'k'], [25, 5, 'k'], [26, 5, 'k'], [27, 5, 'k'], [28, 5, 'k'],
    [25, 1, 'k'],
  ]);
  r = plot(r, [[6, 4, 'F'], [7, 4, 'F'], [7, 5, 'F']]); // 얼룩
  return r;
})();

// 그릴(기계): 철제 상자에 석쇠, 뒤쪽 굴뚝. 0 = 꺼짐, 1~2 = 가동 (연기 + 불빛)
const GRILL_BASE = (() => {
  let r = blank(16, 16);
  r = rect(r, 0, 3, 16, 12, '1');
  r = rect(r, 1, 4, 14, 1, '2');
  r = frame(r, 0, 3, 16, 12, 'k');
  r = rect(r, 1, 15, 15, 1, 'K');
  // 석쇠
  r = rect(r, 2, 6, 12, 6, 'K');
  for (let x = 3; x < 14; x += 2) r = rect(r, x, 6, 1, 6, '2');
  r = frame(r, 2, 6, 12, 6, 'k');
  // 굴뚝 (왼쪽 뒤로 치우침)
  r = rect(r, 2, 0, 3, 4, '2');
  r = frame(r, 2, 0, 3, 4, 'k');
  // 앞쪽 경고 띠와 리벳
  r = plot(r, [[3, 13, 'y'], [4, 13, 'K'], [5, 13, 'y'], [6, 13, 'K'], [7, 13, 'y'], [12, 13, '3'], [14, 5, '3']]);
  r = plot(r, [[10, 12, 'd'], [11, 12, 'd']]); // 기름때
  return r;
})();

export const GRILL = [
  GRILL_BASE,
  plot(GRILL_BASE, [[5, 8, 'r'], [9, 9, 'o'], [11, 7, 'r'], [7, 10, 'o'], [3, 0, '3'], [4, 0, '3'], [3, 1, '2']]),
  plot(GRILL_BASE, [[7, 7, 'r'], [5, 10, 'o'], [11, 9, 'r'], [9, 8, 'o'], [2, 0, '3'], [3, 0, '3'], [4, 1, '2']]),
];

// ── 컨베이어류 (기본 방향 = 오른쪽. 회전은 런타임) ──

// 벨트: 위아래 철제 난간 + 검은 고무 위 '>' 모양 갈빗살. 4프레임으로 2px씩 흐른다.
// 고속 벨트는 난간이 노랑·주황 (실루엣은 같고 색으로만 구분, 갈빗살도 밝게)
const BELT_COLORS = { top: '3', mid: '2', low: '1', rib: '1' };
const FAST_BELT_COLORS = { top: 'y', mid: 'o', low: 'r', rib: '2' };
function beltFrame(frame, c = BELT_COLORS) {
  let r = blank(16, 16);
  r = rect(r, 0, 0, 16, 1, 'k');
  r = rect(r, 0, 1, 16, 1, c.top);
  r = rect(r, 0, 2, 16, 1, c.mid);
  r = rect(r, 0, 3, 16, 10, 'K');
  r = rect(r, 0, 13, 16, 1, c.low);
  r = rect(r, 0, 14, 16, 1, 'k');
  r = rect(r, 0, 15, 16, 1, 'K');
  const pts = [];
  for (let y = 3; y <= 12; y++) {
    const bend = Math.floor(Math.abs(y - 7.5));
    for (let x = 0; x < 16; x++) {
      if ((((x + bend - frame * 2) % 8) + 8) % 8 === 0) pts.push([x, y, c.rib]);
    }
  }
  r = plot(r, pts);
  return plot(r, [[3, 1, 'k'], [11, 14, c.top]]); // 난간 리벳 (위아래 어긋나게)
}
export const BELT = [0, 1, 2, 3].map((f) => beltFrame(f));
export const BELT_FAST = [0, 1, 2, 3].map((f) => beltFrame(f, FAST_BELT_COLORS));

// 분배기: 벨트 위에 철제 뭉치, 위·아래(왼쪽·오른쪽 출구)로 노란 화살
export const SPLITTER = (() => {
  let r = beltFrame(0);
  r = rect(r, 4, 4, 8, 8, '2');
  r = frame(r, 4, 4, 8, 8, 'k');
  r = rect(r, 5, 5, 6, 1, '3');
  r = plot(r, [[7, 1, 'y'], [8, 1, 'y'], [6, 2, 'y'], [9, 2, 'y'], [7, 14, 'y'], [8, 14, 'y'], [6, 13, 'y'], [9, 13, 'y']]);
  r = plot(r, [[7, 7, 'k'], [8, 8, 'k'], [7, 8, 'y'], [8, 7, 'y']]);
  return r;
})();

// 합류기: 세 방향에서 모이는 깔때기, 오른쪽으로 나간다
export const MERGER = (() => {
  let r = beltFrame(0);
  r = rect(r, 3, 4, 10, 8, '1');
  r = frame(r, 3, 4, 10, 8, 'k');
  r = plot(r, [[1, 7, 'y'], [2, 7, 'y'], [1, 8, 'y'], [2, 8, 'y'], [7, 1, 'y'], [8, 2, 'y'], [7, 14, 'y'], [8, 13, 'y']]);
  r = plot(r, [[13, 7, 'y'], [14, 7, 'y'], [13, 8, 'y'], [14, 8, 'y'], [15, 7, 'k'], [15, 8, 'k']]);
  r = rect(r, 5, 6, 6, 4, 'K');
  return r;
})();

// 투입기 몸통: 둥근 철제 받침 + 경고 띠
export const INSERTER_BASE = (() => {
  let r = blank(16, 16);
  r = rect(r, 3, 3, 10, 10, '1');
  r = frame(r, 3, 3, 10, 10, 'k');
  r = plot(r, [[3, 3, '.'], [12, 3, '.'], [3, 12, '.'], [12, 12, '.'], [4, 4, 'k'], [11, 4, 'k'], [4, 11, 'k'], [11, 11, 'k']]);
  r = rect(r, 5, 5, 6, 6, '2');
  r = plot(r, [[5, 5, '3'], [6, 5, '3'], [5, 6, '3']]);
  for (let x = 4; x < 12; x++) r = plot(r, [[x, 12, x % 2 ? 'y' : 'K']]);
  r = rect(r, 4, 13, 9, 1, 'K');
  r = plot(r, [[10, 9, 'd']]);
  return r;
})();

// 투입기 팔: 0 = 뒤(왼쪽)로 뻗음, 1 = 위로 세움, 2 = 앞(오른쪽)으로 뻗음. 끝에 노란 집게.
export const INSERTER_ARM = (() => {
  const back = plot(rect(rect(blank(16, 16), 1, 7, 7, 2, 'o'), 0, 6, 2, 4, 'y'),
    [[1, 6, 'k'], [1, 9, 'k'], [7, 7, 'k'], [7, 8, 'k'], [6, 7, 'r'], [6, 8, 'r']]);
  const mid = plot(rect(rect(blank(16, 16), 7, 1, 2, 7, 'o'), 6, 0, 4, 2, 'y'),
    [[6, 1, 'k'], [9, 1, 'k'], [7, 7, 'k'], [8, 7, 'k'], [7, 6, 'r'], [8, 6, 'r']]);
  const front = plot(rect(rect(blank(16, 16), 8, 7, 7, 2, 'o'), 14, 6, 2, 4, 'y'),
    [[14, 6, 'k'], [14, 9, 'k'], [8, 7, 'k'], [8, 8, 'k'], [9, 7, 'r'], [9, 8, 'r']]);
  return [back, mid, front];
})();

// ── 자동화 라인 기계 (M4). 실루엣만으로 구분되게 모양을 서로 다르게 ──

// 공통 몸통: 철제 상자 + 아래 그림자
function body(w, h, top = 2) {
  let r = blank(w, h);
  r = rect(r, 0, top, w, h - top - 1, '1');
  r = rect(r, 1, top + 1, w - 2, 1, '2');
  r = frame(r, 0, top, w, h - top - 1, 'k');
  r = rect(r, 1, h - 1, w - 1, 1, 'K');
  return r;
}

// 입고구: 위가 열린 철제 투입함 + 경고 빗금 테두리, 위쪽에 작은 셔터
export const SUPPLY = [0, 1].map((f) => {
  let r = body(16, 16, 1);
  r = rect(r, 3, 4, 10, 7, 'K');
  r = frame(r, 3, 4, 10, 7, 'k');
  for (let x = 1; x < 15; x++) r = plot(r, [[x, 13, (x + f) % 4 < 2 ? 'y' : 'K']]);
  r = rect(r, 4, 1, 8, 2, '3');
  r = plot(r, [[4, 2, 'k'], [11, 2, 'k'], [7, 6 + f, '2'], [8, 6 + f, '2'], [13, 2, 'd']]);
  return r;
});

// 정육 절단기: 둥근 톱날이 위에 튀어나온 모양
export const MEAT_CUTTER = [0, 1, 2].map((f) => {
  let r = body(16, 16, 5);
  // 톱날 (프레임마다 이빨 위치가 돈다)
  r = rect(r, 4, 0, 8, 7, '3');
  r = frame(r, 4, 0, 8, 7, 'k');
  r = plot(r, [[4, 0, '.'], [11, 0, '.'], [4, 6, '2'], [11, 6, '2']]);
  const teeth = [[[6, 0], [11, 3], [7, 6]], [[9, 0], [10, 6], [4, 3]], [[5, 1], [11, 5], [8, 6]]][f];
  r = plot(r, teeth.map(([x, y]) => [x, y, 'K']));
  r = plot(r, [[7, 3, 'k'], [8, 3, 'k']]);
  r = plot(r, [[2, 9, 'R'], [3, 9, 'R'], [12, 12, 'd']]); // 핏자국 같은 얼룩
  return r;
});

// 세척기: 물이 담긴 낮은 통 (가동 중이면 물결)
export const WASHER = [0, 1, 2].map((f) => {
  let r = body(16, 16, 3);
  r = rect(r, 2, 5, 12, 7, 'p');
  r = frame(r, 2, 5, 12, 7, 'k');
  const wave = [[4, 7], [9, 8], [6, 10]].map(([x, y]) => [x + f, y, '3']);
  r = plot(r, f === 0 ? [] : wave);
  r = plot(r, [[13, 1, '2'], [13, 2, '2'], [12, 1, '2'], [11, 1, 'p']]); // 수도꼭지
  return r;
});

// 반죽기: 큰 볼 위에 휘젓는 팔
export const MIXER = [0, 1, 2].map((f) => {
  let r = body(16, 16, 6);
  r = rect(r, 3, 4, 10, 8, '3');
  r = frame(r, 3, 4, 10, 8, 'k');
  r = rect(r, 5, 6, 6, 4, 'l');
  r = rect(r, 7, 0, 2, 7, '2');
  r = frame(r, 7, 0, 2, 2, 'k');
  const arm = [[5, 8], [10, 7], [7, 9]][f];
  r = plot(r, [[arm[0], arm[1], 'k'], [arm[0] + 1, arm[1], 'k']]);
  return r;
});

// 오븐: 키 큰 상자, 앞 유리창 (가동 중이면 불빛 깜박)
export const OVEN = [0, 1, 2].map((f) => {
  let r = body(16, 16, 0);
  r = rect(r, 3, 4, 10, 6, f === 0 ? 'K' : f === 1 ? 'r' : 'o');
  r = frame(r, 3, 4, 10, 6, 'k');
  r = rect(r, 3, 11, 10, 1, '3'); // 손잡이
  r = plot(r, [[2, 1, 'r'], [4, 1, 'y'], [6, 1, 'G'], [13, 2, '3']]);
  r = plot(r, [[5, 6, f ? 'y' : '1'], [9, 7, f ? 'y' : '1']]);
  return r;
});

// 버거 조립기 (2x1): 긴 작업대 + 위에서 내려오는 집게 세 개
export const BURGER_ASSEMBLER = [0, 1, 2].map((f) => {
  let r = body(32, 16, 4);
  r = rect(r, 2, 8, 28, 3, 'K');
  for (let x = 2; x < 30; x += 4) r = plot(r, [[x, 9, '1']]);
  for (const [i, x] of [6, 15, 24].entries()) {
    const drop = (f + i) % 3 === 1 ? 2 : 0;
    r = rect(r, x, 0, 2, 5 + drop, '2');
    r = rect(r, x - 1, 5 + drop, 4, 2, 'y');
    r = plot(r, [[x - 1, 6 + drop, 'k'], [x + 2, 6 + drop, 'k']]);
  }
  r = plot(r, [[3, 12, 'y'], [4, 12, 'K'], [5, 12, 'y'], [27, 13, 'd'], [28, 13, 'd']]);
  return r;
});
