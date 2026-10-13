// 돈과 판매. 지금은 고정 시세 (시세 변동은 M5).
import { record, recordEarned } from './stats.js';

export function sellItem(world, rules, item, station) {
  const price = rules.items[item].price;
  world.money += price;
  world.stats.sold[item] = (world.stats.sold[item] ?? 0) + 1;
  world.stats.earned += price;
  record(world, 'sold', item);
  recordEarned(world, price);
  world.events.push({ type: 'sold', item, price, x: station.x + station.w / 2, y: station.y });
}
