// 길찾기: 격자 위 4방향 너비 우선 탐색. 걸을 수 있는 칸(벽·기계가 없는 바닥, 벨트 위는 가능)만 지난다.
import { isSolid, inBounds } from './grid.js';
import { DIRS } from './lookup.js';

const key = (x, y) => `${x},${y}`;

/**
 * start 에서 goals 중 가장 가까운 칸까지의 경로 (start 제외, 도착 칸 포함).
 * @param goals [{x,y}] 도착해도 되는 칸들
 * @returns [{x,y}] 또는 null (갈 수 없음). 이미 도착해 있으면 빈 배열.
 */
export function findPath(grid, start, goals) {
  const goalSet = new Set(goals.filter((g) => inBounds(grid, g.x, g.y) && !isSolid(grid, g.x, g.y)).map((g) => key(g.x, g.y)));
  if (goalSet.size === 0) return null;
  if (goalSet.has(key(start.x, start.y))) return [];

  const prev = new Map([[key(start.x, start.y), null]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const k = key(nx, ny);
      if (prev.has(k) || isSolid(grid, nx, ny)) continue;
      prev.set(k, cur);
      const next = { x: nx, y: ny };
      if (goalSet.has(k)) {
        const path = [next];
        for (let p = cur; p && !(p.x === start.x && p.y === start.y); p = prev.get(key(p.x, p.y))) path.unshift(p);
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** 기계 둘레의 걸을 수 있는 칸들 (거기 서서 기계를 바라보면 작업할 수 있다) + 그 칸에서 기계를 보는 방향 */
export function stationApproaches(grid, st) {
  const out = [];
  for (let y = st.y; y < st.y + st.h; y++) {
    for (let x = st.x; x < st.x + st.w; x++) {
      DIRS.forEach(([dx, dy], dir) => {
        const ax = x - dx;
        const ay = y - dy;
        const inside = ax >= st.x && ax < st.x + st.w && ay >= st.y && ay < st.y + st.h;
        if (!inside && inBounds(grid, ax, ay) && !isSolid(grid, ax, ay)) out.push({ x: ax, y: ay, face: dir });
      });
    }
  }
  return out;
}
