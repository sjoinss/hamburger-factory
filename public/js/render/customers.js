// 손님 줄: 출고구 창구 앞 길에 주문 순서대로 선다. 말풍선에 주문 품목, 끝나면 반응하고 오른쪽으로 떠난다.
import { HAIR_COLORS, SHIRT_COLORS } from '../sprites/customers.js';
import { TILE, getTile } from '../sim/grid.js';

const REACT_SECONDS = 1.2; // 기쁨/실망 표정을 보여주는 시간
const WALK_TILES_PER_SECOND = 4;

const BUBBLE_BORDER = { normal: 'K' };

/**
 * @param px 원본 픽셀 → 기기 픽셀 변환 함수들은 world.js 에서 받는다
 */
export function drawCustomers(ctx, world, rules, bank, h) {
  const counter = world.stations.find((s) => rules.machines[s.type].kind === 'counter');
  if (!counter || !world.features.includes('orders')) return;
  const ts = rules.game.tileSize;
  const rowY = counter.y + counter.h + 1; // 창구 바로 아래 길
  // 길 끝 (그 너머는 구역 벽이나 빈 땅이라 거기서 사라진다)
  let streetEnd = counter.x;
  while (getTile(world.grid, streetEnd, rowY) === TILE.STREET) streetEnd += 1;

  world.orders.list.forEach((order, slot) => {
    const look = order.look;
    const [shirt, shirtDark] = SHIRT_COLORS[look.shirt % SHIRT_COLORS.length];
    const map = { H: HAIR_COLORS[look.hair % HAIR_COLORS.length], C: shirt, D: shirtDark };

    let x = (counter.x + slot) * ts;
    let frame = 0;
    if (order.state !== 'open') {
      const since = world.time - (order.leaveAt - rules.orders.leaveSeconds);
      frame = order.state === 'done' ? 1 : 2;
      if (since > REACT_SECONDS) x += (since - REACT_SECONDS) * WALK_TILES_PER_SECOND * ts;
    }
    if (x >= (streetEnd - 1) * ts) return;
    const y = rowY * ts - 4;
    // 2px 단위로 끊어서 걷는다 (도트 느낌)
    const img = bank.recolor('customer', frame, map);
    h.image(img, Math.floor(x / 2) * 2, y);
    if (order.state === 'open') drawBubble(order, x + 8, y - 1);
  });

  /** 말풍선: 품목 아이콘 + ×수량 (아직 남은 수량) */
  function drawBubble(order, cx, bottom) {
    const parts = Object.entries(order.items)
      .map(([id, n]) => [id, n - (order.delivered[id] ?? 0)])
      .filter(([, n]) => n > 0);
    const digitsW = (n) => String(n).length * 4;
    const w = parts.reduce((a, [, n]) => a + 8 + 4 + digitsW(n) + 1, 3);
    const hgt = 12;
    const left = Math.round(cx - w / 2);
    const top = bottom - hgt - 3;
    const border = BUBBLE_BORDER[order.kind] ?? 'K';
    h.fill(border, left, top, w, hgt);
    h.fill('l', left + 1, top + 1, w - 2, hgt - 2);
    // 꼬리
    h.fill(border, cx - 1, top + hgt, 3, 1);
    h.fill(border, cx, top + hgt + 1, 1, 2);
    let x = left + 2;
    for (const [id, n] of parts) {
      h.image(bank.mini(rules.items[id].sprite), x, top + 2);
      x += 8;
      h.image(bank.get('digitx'), x, top + 4);
      x += 4;
      for (const d of String(n)) {
        h.image(bank.get(`digit${d}`), x, top + 4);
        x += 4;
      }
      x += 1;
    }
  }
}
