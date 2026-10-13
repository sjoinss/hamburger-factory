// 격자. 순수 데이터 + 함수. DOM/Canvas 를 모른다.

export const TILE = Object.freeze({ FLOOR: 'floor', WALL: 'wall' });

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
  return grid.tiles[i] === TILE.WALL || grid.solid[i];
}

/** 방 하나(바닥) + 둘레 벽으로 된 시작 격자. */
export function createRoomGrid(roomWidth, roomHeight, wallThickness) {
  const width = roomWidth + wallThickness * 2;
  const height = roomHeight + wallThickness * 2;
  const grid = createGrid(width, height, TILE.FLOOR);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge =
        x < wallThickness || y < wallThickness ||
        x >= width - wallThickness || y >= height - wallThickness;
      if (edge) setTile(grid, x, y, TILE.WALL);
    }
  }
  return grid;
}
