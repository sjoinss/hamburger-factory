// 일회성 연출 (판매 동전 등). 시뮬레이션 events 를 받아 실제 시간으로 재생한다.

const COIN_SECONDS = 1.0;

export function createEffects(tileSize, fontFamily) {
  let list = [];

  return {
    /** world.events 를 받아 연출로 바꾼다 */
    push(event) {
      if (event.type === 'sold') {
        list.push({ kind: 'coin', x: event.x * tileSize, y: event.y * tileSize, t: 0, text: `+${event.price}` });
      }
    },
    update(dt) {
      for (const e of list) e.t += dt;
      list = list.filter((e) => e.t < COIN_SECONDS);
    },
    /** still: 움직임 줄이기 (떠오르지 않고 제자리에 잠깐 보인다) */
    draw(ctx, bank, sx, sy, s, still = false) {
      if (list.length === 0) return;
      // 픽셀 폰트는 12px 배수에서만 선명하다.
      const k = Math.max(1, Math.floor(s / 2));
      ctx.font = `${12 * k}px ${fontFamily}`;
      ctx.textBaseline = 'top';
      for (const e of list) {
        // 프레임 스왑처럼 2px 단위로 끊어서 올라간다.
        const rise = still ? 0 : Math.floor((e.t / COIN_SECONDS) * 12 / 2) * 2;
        const x = e.x - 4;
        const y = e.y - 10 - rise;
        const coin = bank.get('coin');
        ctx.drawImage(coin, sx(x), sy(y), coin.width * s, coin.height * s);
        const tx = sx(x + 10);
        const ty = sy(y - 1);
        ctx.fillStyle = bank.color('K');
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(e.text, tx + dx * k, ty + dy * k);
        ctx.fillStyle = bank.color('y');
        ctx.fillText(e.text, tx, ty);
      }
    },
  };
}
