// 주문서 보드: 최대 6건. 품목마다 필요/호퍼 보유/부족을 글로, 남은 시간, 보상, 게이트에 맡기기.
import { openOrders, orderNeeds, spawnInterval } from '../sim/orders.js';
import { stockedTotal } from '../sim/storage.js';
import { marketPrice } from '../sim/market.js';
import { setGateOrder } from '../sim/gate.js';
import { spriteIcon } from './icons.js';

export function createOrderBoard({ world, rules, bank, onAssigned }) {
  const list = document.getElementById('order-list');
  const empty = document.getElementById('order-empty');
  const headline = document.getElementById('market-headline');
  const rate = document.getElementById('order-rate');
  let lastRender = -Infinity;

  const gates = () => world.stations.filter((s) => rules.machines[s.type].kind === 'gate');

  function assign(order) {
    const all = gates();
    if (all.length === 0) return;
    // 이미 이 주문을 맡은 게이트가 없으면, 놀고 있는 게이트 → 아무 게이트 순으로
    const idle = all.find((g) => g.status !== 'running' && g.mode.kind !== 'order') ?? all.find((g) => g.status !== 'running') ?? all[0];
    setGateOrder(idle, order.id);
    onAssigned?.(idle, order);
    lastRender = -Infinity;
  }

  function row(order) {
    const li = document.createElement('li');
    li.className = `order order-${order.kind}`;

    const head = document.createElement('div');
    head.className = 'order-head';
    const kind = document.createElement('span');
    kind.className = 'order-kind';
    kind.textContent = rules.orders.kinds[order.kind].name;
    const reward = document.createElement('span');
    reward.className = 'order-reward';
    reward.textContent = `+${order.reward}`;
    const time = document.createElement('span');
    time.className = 'order-time';
    if (order.deadline !== null) {
      const left = Math.max(0, Math.ceil(order.deadline - world.time));
      time.textContent = `남은 ${left}초`;
      if (left <= 20) time.classList.add('is-urgent');
    }
    head.append(kind, reward, time);

    const items = document.createElement('ul');
    items.className = 'order-items';
    for (const [id, n] of Object.entries(order.items)) {
      const need = orderNeeds(order, id);
      const stock = stockedTotal(world, rules, id);
      const it = document.createElement('li');
      it.append(spriteIcon(bank, rules.items[id].sprite));
      const label = document.createElement('span');
      const shortBy = need - stock;
      label.textContent = `${rules.items[id].name} ${n - need}/${n} · 보유 ${stock}${need > 0 && shortBy > 0 ? ` · 부족 -${shortBy}` : ''}`;
      if (need === 0) label.classList.add('is-done');
      else if (shortBy > 0) label.classList.add('is-short');
      it.append(label);
      items.append(it);
    }

    const actions = document.createElement('div');
    actions.className = 'order-actions';
    const assigned = gates().find((g) => g.mode.kind === 'order' && g.mode.orderId === order.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    if (assigned) {
      btn.textContent = assigned.mode.auto ? '인식기가 맡김: 출고 중' : '게이트가 출고 중';
      btn.disabled = true;
    } else if (gates().length === 0) {
      btn.textContent = '출고 게이트 없음';
      btn.disabled = true;
    } else {
      btn.textContent = '게이트에 맡기기';
      btn.addEventListener('click', () => assign(order));
    }
    actions.append(btn);

    li.append(head, items, actions);
    return li;
  }

  return {
    render(nowMs) {
      if (nowMs - lastRender < 500) return;
      lastRender = nowMs;
      const enabled = world.features.includes('orders');
      const open = enabled ? openOrders(world) : [];
      empty.hidden = open.length > 0;
      empty.textContent = enabled
        ? '손님을 기다리는 중. 만든 물건은 출고구에서 주문을 먼저 채우고, 남으면 시세로 팔린다.'
        : '아직 주문이 없다. 만든 물건은 출고구에서 팔린다. (햄버거 15개를 팔면 주문서가 열린다)';
      list.replaceChildren(...open.map(row));
      rate.hidden = !enabled;
      rate.textContent = `평판 ${world.reputation} · 손님이 ${Math.round(spawnInterval(world, rules))}초마다 온다`;

      const mk = world.market;
      if (world.features.includes('market') && mk.headline) {
        const id = mk.headline;
        const pct = Math.round(((mk.mult[id] ?? 1) - 1) * 100);
        headline.textContent = `오늘의 인기: ${rules.items[id].name} ${marketPrice(world, rules, id)} (${pct >= 0 ? '+' : ''}${pct}%)`;
        headline.hidden = false;
      } else {
        headline.hidden = true;
      }
    },
    forceRender() { lastRender = -Infinity; },
  };
}
