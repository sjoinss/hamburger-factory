// 격자. 순수 데이터 + 함수. DOM/Canvas 를 모른다.

// STREET: 가게 밖 길 (손님 줄), WINDOW: 출고구 뒤 창구. 둘 다 플레이어는 못 들어간다.
// LOCKED: 아직 사지 않은 구역 바닥
export const TILE = Object.freeze({ FLOOR: 'floor', WALL: 'wall', STREET: 'street', WINDOW: 'window', LOCKED: 'locked' });

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
 * 방 하나(바닥) + 둘레 벽 + (아래쪽) 가게 앞 길.
 * zones: 오른쪽에 이어 붙는 잠긴 구역들 [{ x, w }] — 사이마다 벽 한 줄.
 */
export function createRoomGrid(roomWidth, roomHeight, wallThickness, streetRows = 0, zones = []) {
  const right = zones.length ? Math.max(...zones.map((z) => z.x + z.w)) : roomWidth + wallThickness;
  const width = right + wallThickness;
  const roomH = roomHeight + wallThickness * 2;
  const height = roomH + streetRows;
  const grid = createGrid(width, height, TILE.FLOOR);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y >= roomH) { setTile(grid, x, y, TILE.STREET); continue; }
      const edge =
        x < wallThickness || y < wallThickness ||
        x >= width - wallThickness || y >= roomH - wallThickness;
      if (edge) setTile(grid, x, y, TILE.WALL);
      else if (x > roomWidth) {
        // 시작 방 오른쪽: 구역 안이면 잠긴 바닥, 구역 사이는 벽
        const inZone = zones.some((z) => x >= z.x && x < z.x + z.w);
        setTile(grid, x, y, inZone ? TILE.LOCKED : TILE.WALL);
      }
    }
  }
  return grid;
}
