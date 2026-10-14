// 격자. 순수 데이터 + 함수. DOM/Canvas 를 모른다.

// STREET: 가게 밖 길 (손님 줄), WINDOW: 출고구 뒤 창구. 둘 다 플레이어는 못 들어간다.
// LOCKED: 아직 사지 않은 구역 바닥, VOID: 공장 밖 빈 땅 (구역도 길도 아닌 곳)
export const TILE = Object.freeze({ FLOOR: 'floor', WALL: 'wall', STREET: 'street', WINDOW: 'window', LOCKED: 'locked', VOID: 'void' });

export function createGrid(width, height, fill = TILE.FLOOR) {
  return {
    width,
    height,
    tiles: new Array(width * height).fill(fill),
    // 칸을 차지한 물체 id. 없으면 null.
    occupant: new Array(width * height).fill(null),
    // 지나갈 수 없는 물체가 있는 칸 (컨베이어처럼 밟고 지나가는 물체는 false)
    solid: new Array(width * height).fill(false),
  };
}

export function inBounds(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function getTile(grid, x, y) {
  return inBounds(grid, x, y) ? grid.tiles[y * grid.width + x] : null;
}

export function setTile(grid, x, y, type) {
  if (inBounds(grid, x, y)) grid.tiles[y * grid.width + x] = type;
}

export function getOccupant(grid, x, y) {
  return inBounds(grid, x, y) ? grid.occupant[y * grid.width + x] : null;
}

export function setOccupant(grid, x, y, id, solid = id !== null) {
  if (!inBounds(grid, x, y)) return;
  grid.occupant[y * grid.width + x] = id;
  grid.solid[y * grid.width + x] = solid;
}

/** 걸어서 지나갈 수 없는 칸인가. 격자 밖은 막힌 것으로 본다. */
export function isSolid(grid, x, y) {
  if (!inBounds(grid, x, y)) return true;
  const i = y * grid.width + x;
  return grid.tiles[i] !== TILE.FLOOR || grid.solid[i];
}

/**
 * 시작 방(바닥) + 둘레 벽 + 시작 방 아래 가게 앞 길 + 잠긴 구역들.
 * zones: [{ x, y, w, h }] 구역 안쪽 사각형. 둘레는 벽이고, 이웃과는 벽 한 줄을 같이 쓴다.
 */
export function createRoomGrid(roomWidth, roomHeight, wallThickness, streetRows = 0, zones = []) {
  const wall = wallThickness;
  const roomW = roomWidth + wall * 2;
  const roomH = roomHeight + wall * 2;
  const width = Math.max(roomW, ...zones.map((z) => z.x + z.w + wall));
  const height = Math.max(roomH + streetRows, ...zones.map((z) => z.y + z.h + wall));
  const grid = createGrid(width, height, TILE.VOID);
  const room = (x0, y0, w, h, inside) => {
    for (let y = y0 - wall; y < y0 + h + wall; y++) {
      for (let x = x0 - wall; x < x0 + w + wall; x++) {
        const isIn = x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
        setTile(grid, x, y, isIn ? inside : TILE.WALL);
      }
    }
  };
  room(wall, wall, roomWidth, roomHeight, TILE.FLOOR);
  for (const z of zones) room(z.x, z.y, z.w, z.h, TILE.LOCKED);
  // 길은 시작 방 아래 빈 땅에만 (구역 벽이 지나가는 칸은 벽 그대로)
  for (let y = roomH; y < roomH + streetRows; y++) {
    for (let x = 0; x < roomW; x++) if (getTile(grid, x, y) === TILE.VOID) setTile(grid, x, y, TILE.STREET);
  }
  return grid;
}
