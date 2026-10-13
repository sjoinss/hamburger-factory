// 투입기: 뒤 칸에서 집어 앞 칸에 놓는다. 앞에 놓을 수 있는 물건만 집는다 (집게에 걸려 멈추지 않게).
import { stationAt, DIRS } from './lookup.js';
import { canAccept, machineOf } from './station.js';
import { canInsertAt, insertSorted, makeBeltItem } from './conveyor.js';
import { groundItemAt } from './interact.js';
import { receiveAtCounter } from './orders.js';
import { store } from './storage.js';
import { noteTutorial } from './tutorial.js';

export function inserterTiles(ins) {
  const [dx, dy] = DIRS[ins.rot];
  return { from: { x: ins.x - dx, y: ins.y - dy }, to: { x: ins.x + dx, y: ins.y + dy } };
}

/** 뒤 칸에서 집을 수 있는 물건 후보들: [{ item, take() }] */
function pickCandidates(world, rules, tile) {
  const st = stationAt(world, tile.x, tile.y);
  if (!st) {
    const g = groundItemAt(world, tile.x, tile.y);
    if (!g) return [];
    return [{ item: g.item, take: () => { world.groundItems = world.groundItems.filter((x) => x !== g); } }];
  }
  const kind = machineOf(rules, st).kind;
  if (kind === 'machine' || kind === 'crafter' || kind === 'supply') {
    return st.output.length ? [{ item: st.output[0], take: () => st.output.shift() }] : [];
  }
  if (kind === 'belt') {
    // 앞쪽(끝에 가까운) 물건부터
    return st.items.map((it) => ({ item: it.item, take: () => st.items.splice(st.items.indexOf(it), 1) }));
  }
  if ((kind === 'splitter' || kind === 'merger') && st.buffer) {
    const b = st.buffer;
    return [{ item: b.item, take: () => { st.buffer = null; } }];
  }
  return []; // 재료 상자, 출고구, 다른 투입기에서는 집지 않는다
}

/** 앞 칸에 item 을 놓는 함수. 놓을 수 없으면 null. */
function dropTarget(world, rules, ins, tile, item) {
  const st = stationAt(world, tile.x, tile.y);
  if (!st) return null; // 빈 바닥에는 놓지 않는다
  const kind = machineOf(rules, st).kind;
  if (kind === 'crafter' || kind === 'machine' || kind === 'counter' || kind === 'storage') {
    if (!canAccept(rules, st, item, world)) return null;
    return () => {
      if (kind === 'counter') receiveAtCounter(world, rules, item, st);
      else if (kind === 'storage') store(st, item);
      else st.contents.push(item);
      noteTutorial(world, 'fed', st.type);
    };
  }
  if (kind === 'belt') {
    if (!canInsertAt(st.items, 0.5)) return null;
    return () => {
      const from = { x: ins.x + 0.5, y: ins.y + 0.5 };
      insertSorted(st.items, makeBeltItem(st, item, 0.5, from));
      noteTutorial(world, 'fed', st.type);
    };
  }
  if ((kind === 'splitter' || kind === 'merger') && !st.buffer) {
    return () => {
      st.buffer = makeBeltItem(st, item, 0.5);
      noteTutorial(world, 'fed', st.type);
    };
  }
  return null;
}

/** 0 = 뒤(집는 쪽), 1 = 가운데, 2 = 앞(놓는 쪽). 렌더러가 팔 모양을 고른다. */
export function inserterArmPhase(rules, ins) {
  const half = machineOf(rules, ins).seconds / 2;
  if (ins.held && !ins.dropped) return Math.min(2, Math.floor((ins.t / half) * 3));
  if (ins.dropped) return 2 - Math.min(2, Math.floor(((ins.t - half) / half) * 3));
  return 0;
}

export function updateInserter(world, rules, ins, dt) {
  const cycle = machineOf(rules, ins).seconds;
  const half = cycle / 2;
  const { from, to } = inserterTiles(ins);

  if (!ins.held && !ins.dropped) {
    for (const c of pickCandidates(world, rules, from)) {
      if (!dropTarget(world, rules, ins, to, c.item)) continue;
      c.take();
      ins.held = c.item;
      ins.t = dt;
      ins.status = 'running';
      ins.active = true;
      return;
    }
    ins.status = 'idle';
    return;
  }

  ins.t += dt;
  ins.active = true;
  if (ins.held && ins.t >= half) {
    const drop = dropTarget(world, rules, ins, to, ins.held);
    if (!drop) {
      ins.t = half; // 놓을 자리가 날 때까지 팔을 뻗은 채 대기
      ins.status = 'blocked';
      return;
    }
    drop();
    ins.held = null;
    ins.dropped = true;
  }
  ins.status = 'running';
  if (ins.dropped && ins.t >= cycle) {
    ins.t = 0;
    ins.dropped = false;
  }
}
