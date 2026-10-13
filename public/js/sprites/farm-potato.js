// 감자밭 (2x2, 4프레임). 밭 공통 모양은 farm.js 와 같은 방식.
import { blank, plot, rect, frame } from './draw.js';

function plot2x2() {
  let r = blank(32, 32);
  r = rect(r, 0, 0, 32, 31, 'd');
  for (let y = 4; y < 30; y += 7) r = rect(r, 2, y + 3, 28, 1, 'm');
  r = frame(r, 0, 0, 32, 31, 'B');
  r = frame(r, 1, 1, 30, 29, 'b');
  r = rect(r, 1, 31, 31, 1, 'K');
  return plot(r, [[0, 0, 'k'], [31, 0, 'k'], [0, 30, 'k'], [31, 30, 'k'], [9, 0, 'k'], [24, 30, 'k'], [0, 13, 'k']]);
}

export const FIELD_POTATO = [0, 1, 2, 3].map((stage) => {
  let r = plot2x2();
  [5, 12, 19, 26].forEach((y, j) => [5, 11, 17, 23].forEach((x0) => {
    const x = x0 + (j % 2) * 2;
    if (stage === 0) r = plot(r, [[x, y + 1, 'g']]);
    else if (stage === 1) r = plot(r, [[x, y, 'g'], [x + 1, y, 'g']]);
    else if (stage === 2) r = plot(r, [[x - 1, y - 1, 'g'], [x + 1, y - 1, 'g'], [x, y, 'G'], [x - 1, y, 'g'], [x + 1, y, 'g']]);
    else r = plot(r, [[x - 1, y - 1, 'G'], [x + 1, y - 1, 'G'], [x, y - 1, 'g'], [x - 1, y + 1, 'b'], [x, y + 1, 'b'], [x + 1, y + 1, 'B']]);
  }));
  return r;
});
