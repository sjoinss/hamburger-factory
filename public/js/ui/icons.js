// 아이템/기계 스프라이트를 그대로 UI 아이콘으로 쓴다 (별도 아이콘 세트 없음).

export function spriteIcon(bank, spriteName) {
  const src = bank.get(spriteName);
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  cv.setAttribute('aria-hidden', 'true');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  return cv;
}
