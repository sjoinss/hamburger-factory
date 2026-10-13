// 플레이어 이동. 위치 단위는 타일(칸 중심 = n + 0.5).
import { isSolid } from './grid.js';

const EPS = 1e-4;

export function createPlayer(tileX, tileY, carryCapacity) {
  const x = tileX + 0.5;
  const y = tileY + 0.5;
  return {
    x, y, prevX: x, prevY: y,
    dir: 'down', moving: false, walkTime: 0,
    inventory: new Array(carryCapacity).fill(null),
    working: false,
  };
}

function overlapsSolid(grid, cx, cy, half) {
  const x0 = Math.floor(cx - half);
  const x1 = Math.floor(cx + half - EPS);
  const y0 = Math.floor(cy - half);
  const y1 = Math.floor(cy + half - EPS);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(grid, tx, ty)) return true;
    }
  }
  return false;
}

/** 축 하나씩 이동하고, 막히면 벽 면에 딱 붙인다. */
function moveAxis(player, grid, delta, half, axis) {
  if (delta === 0) return;
  const next = player[axis] + delta;
  const cx = axis === 'x' ? next : player.x;
  const cy = axis === 'y' ? next : player.y;
  if (!overlapsSolid(grid, cx, cy, half)) {
    player[axis] = next;
    return;
  }
  player[axis] = delta > 0
    ? Math.floor(next + half) - half - EPS
    : Math.floor(next - half) + 1 + half + EPS;
}

/**
 * @param input {{ moveX: number, moveY: number }} -1~1
 * @param cfg {{ tilesPerSecond: number, hitbox: number }}
 */
export function updatePlayer(player, grid, input, dt, cfg) {
  player.prevX = player.x;
  player.prevY = player.y;

  let mx = input.moveX;
  let my = input.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }

  const moving = len > 0;
  if (moving) {
    if (Math.abs(mx) > Math.abs(my)) player.dir = mx > 0 ? 'right' : 'left';
    else player.dir = my > 0 ? 'down' : 'up';
  }

  const half = cfg.hitbox / 2;
  const step = cfg.tilesPerSecond * dt;
  moveAxis(player, grid, mx * step, half, 'x');
  moveAxis(player, grid, my * step, half, 'y');

  player.moving = moving && (player.x !== player.prevX || player.y !== player.prevY);
  player.walkTime = player.moving ? player.walkTime + dt : 0;
}
