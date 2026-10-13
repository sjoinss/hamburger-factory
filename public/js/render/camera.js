// 카메라. 좌표는 "원본 픽셀"(타일 1칸 = tileSize px) 단위.

export function createCamera(cfg) {
  return { x: 0, y: 0, zoom: cfg.defaultZoom, minZoom: cfg.minZoom, maxZoom: cfg.maxZoom, follow: true };
}

/** 기기 픽셀 기준 배율. 반드시 정수여야 도트가 번지지 않는다. */
export function pixelScale(camera, dpr) {
  return Math.max(1, Math.round(camera.zoom * dpr));
}

export function setZoom(camera, zoom) {
  camera.zoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, Math.round(zoom)));
}

/** 월드 원점이 화면에 그려질 기기 픽셀 위치 (정수). */
export function viewOrigin(camera, view) {
  return {
    ox: Math.round(view.width / 2 - camera.x * view.scale),
    oy: Math.round(view.height / 2 - camera.y * view.scale),
  };
}

export function screenToWorld(camera, view, sx, sy) {
  const { ox, oy } = viewOrigin(camera, view);
  return { x: (sx - ox) / view.scale, y: (sy - oy) / view.scale };
}

/** 맵이 화면보다 작으면 가운데, 크면 맵 밖으로 너무 나가지 않게. */
export function clampCamera(camera, view, worldW, worldH) {
  const halfW = view.width / 2 / view.scale;
  const halfH = view.height / 2 / view.scale;
  const margin = 32;
  camera.x = worldW <= halfW * 2
    ? worldW / 2
    : Math.min(worldW - halfW + margin, Math.max(halfW - margin, camera.x));
  camera.y = worldH <= halfH * 2
    ? worldH / 2
    : Math.min(worldH - halfH + margin, Math.max(halfH - margin, camera.y));
}
