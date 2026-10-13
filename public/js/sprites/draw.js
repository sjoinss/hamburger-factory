// 도트 문자열 배열을 조립하는 작은 도구. 결과는 그대로 문자열 배열이다.

export function blank(w, h, ch = '.') {
  return Array.from({ length: h }, () => ch.repeat(w));
}

/** rows 를 복사해 점들을 찍은 새 배열을 돌려준다. points: [x, y, ch][] */
export function plot(rows, points) {
  const grid = rows.map((r) => [...r]);
  for (const [x, y, ch] of points) {
    if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = ch;
  }
  return grid.map((r) => r.join(''));
}

export function rect(rows, x, y, w, h, ch) {
  const pts = [];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) pts.push([i, j, ch]);
  return plot(rows, pts);
}

/** 테두리만 */
export function frame(rows, x, y, w, h, ch) {
  const pts = [];
  for (let i = x; i < x + w; i++) pts.push([i, y, ch], [i, y + h - 1, ch]);
  for (let j = y; j < y + h; j++) pts.push([x, j, ch], [x + w - 1, j, ch]);
  return plot(rows, pts);
}
