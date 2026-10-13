// 탭해서 이동: 목적지까지 길을 찾고, 틱마다 다음 칸 쪽으로 걷는 입력을 만든다.
// 시뮬레이션은 그대로 '걷기 입력'만 받으므로 키보드로 걷는 것과 똑같이 충돌·속도가 적용된다.
import { findPath, stationApproaches } from '../sim/path.js';
import { DIRS } from '../sim/lookup.js';

const ARRIVE = 0.04; // 칸 중심에 이만큼 가까우면 도착
const STUCK_TICKS = 15; // 이만큼 제자리면 포기 (누가 길을 막음)

export function createWalker({ world, rules }) {
  let path = null; // 남은 칸들
  let face = null; // 도착 후 바라볼 방향 (기계로 갔을 때)
  let dest = null; // 표시용 목적지 칸
  let stuck = 0;
  let last = null;

  const tileOf = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) });

  function start(newPath, faceDir, destTile) {
    path = newPath;
    face = faceDir;
    dest = destTile;
    stuck = 0;
    last = null;
  }

  return {
    /** 빈 바닥 칸으로. 못 가면 false */
    walkTo(x, y) {
      const p = findPath(world.grid, tileOf(world.player), [{ x, y }]);
      if (!p) return false;
      start(p, null, { x, y });
      return true;
    },
    /** 기계 앞으로 가서 기계를 바라본다. 못 가면 false */
    walkToStation(st) {
      const spots = stationApproaches(world.grid, st);
      const p = findPath(world.grid, tileOf(world.player), spots);
      if (!p) return false;
      const end = p.length ? p[p.length - 1] : tileOf(world.player);
      const spot = spots.find((s) => s.x === end.x && s.y === end.y);
      start(p, spot ? spot.face : null, { x: st.x, y: st.y, w: st.w, h: st.h });
      return true;
    },
    cancel() {
      path = null;
      face = null;
      dest = null;
    },
    active: () => path !== null,
    /** 그릴 목적지 (칸 또는 기계 영역) */
    destination: () => dest,
    /** 이번 틱의 걷기 입력 { moveX, moveY } 또는 null (걷는 중이 아님) */
    intent() {
      if (!path) return null;
      const p = world.player;
      if (path.length === 0) {
        // 도착: 기계 쪽으로 아주 살짝 밀어 방향만 돌린다 (막혀 있어서 움직이지는 않는다)
        const dir = face;
        this.cancel();
        if (dir === null) return null;
        const [dx, dy] = DIRS[dir];
        return { moveX: dx * 0.05, moveY: dy * 0.05 };
      }
      const target = path[0];
      const dx = target.x + 0.5 - p.x;
      const dy = target.y + 0.5 - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ARRIVE) {
        path.shift();
        return this.intent();
      }
      // 제자리걸음 감지 (다른 물체가 길을 막는 등)
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-4) {
        if (++stuck > STUCK_TICKS) {
          this.cancel();
          return null;
        }
      } else stuck = 0;
      last = { x: p.x, y: p.y };
      // 마지막 한 걸음은 남은 거리만큼만 (지나쳐서 왔다 갔다 하지 않게)
      const step = rules.game.player.tilesPerSecond / rules.game.ticksPerSecond;
      const scale = Math.min(1, dist / step) / dist;
      return { moveX: dx * scale, moveY: dy * scale };
    },
  };
}
