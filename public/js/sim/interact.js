// 플레이어 수동 작업. 바라보는 칸을 대상으로 E(누르기/길게 누르기), Q(내려놓기).
import { getOccupant, isSolid } from './grid.js';
import { stationAt } from './lookup.js';
import { canInsertAt, insertSorted, makeBeltItem } from './conveyor.js';
import { machineOf, canAccept, readyRecipe, missingInputs, advanceWork, workSeconds, farmGrowth } from './station.js';
import { receiveAtCounter } from './orders.js';
import { store, takeFromStorage, mostStocked } from './storage.js';
import { noteTutorial } from './tutorial.js';
import { record, recordRecipe } from './stats.js';

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function facingTile(player, reach) {
  const [dx, dy] = DIR[player.dir];
  return { x: Math.floor(player.x + dx * reach), y: Math.floor(player.y + dy * reach) };
}

export const freeSlot = (player) => player.inventory.indexOf(null);
const hasSpace = (player) => freeSlot(player) !== -1;


export function groundItemAt(world, x, y) {
  return world.groundItems.find((g) => g.x === x && g.y === y) ?? null;
}

/**
 * 지금 E 를 누르면 무슨 일이 일어나는지. 시뮬레이션과 UI 안내가 같은 판단을 쓴다.
 * action: take | deposit | sell | work | gather | pickup | blocked | idle
 */
export function findInteraction(world, rules) {
  const p = world.player;
  const tile = facingTile(p, rules.game.player.reach);
  const station = stationAt(world, tile.x, tile.y);

  if (station) {
    const machine = machineOf(rules, station);
    const base = { station, machine, tile };

    // 완성품 꺼내기 (자동 기계와 밭은 아래에서 따로: 밭은 길게 눌러 수확)
    if (station.output.length > 0 && machine.kind !== 'machine' && machine.kind !== 'farm') {
      return hasSpace(p)
        ? { ...base, action: 'take', item: station.output[0] }
        : { ...base, action: 'blocked', reason: 'full' };
    }
    if (machine.kind === 'counter') {
      const slot = p.inventory.findIndex((it) => it !== null && canAccept(rules, station, it, world));
      if (slot !== -1) return { ...base, action: 'sell', slot, item: p.inventory[slot] };
      return { ...base, action: 'blocked', reason: p.inventory.some(Boolean) ? 'unsellable' : 'empty-hands' };
    }
    if (machine.kind === 'crafter') {
      const slot = p.inventory.findIndex((it) => it !== null && canAccept(rules, station, it));
      if (slot !== -1) return { ...base, action: 'deposit', slot, item: p.inventory[slot] };
      const recipe = readyRecipe(rules, station);
      if (recipe) {
        return { ...base, action: 'work', hold: true, recipe, progress: station.progress / workSeconds(rules, station, recipe) };
      }
      return { ...base, action: 'blocked', reason: 'needs', missing: missingInputs(rules, station) };
    }
    if (machine.kind === 'belt') {
      // E: 비어 있는 손이 있으면 맨 앞 물건 집기, 아니면 든 물건 올리기 (Q 로도 올릴 수 있다)
      // 주문 묶음은 손으로 집지 않는다 (번호표가 떨어지면 주문을 못 채운다)
      const bagFirst = station.items.length > 0 && rules.items[station.items[0].item].category === 'bundle';
      if (station.items.length > 0 && hasSpace(p) && !bagFirst) {
        return { ...base, action: 'belt-take', item: station.items[0].item, count: station.items.length };
      }
      const slot = p.inventory.findIndex((it) => it !== null);
      if (slot !== -1 && canInsertAt(station.items, 0.5)) return { ...base, action: 'belt-put', slot, item: p.inventory[slot] };
      if (slot !== -1) return { ...base, action: 'blocked', reason: 'belt-busy' };
      return { ...base, action: 'blocked', reason: bagFirst ? 'bag' : 'belt-empty' };
    }
    if (machine.kind === 'farm') {
      // 다 자랐으면 E 를 길게 눌러 하나씩 수확
      if (station.output.length === 0) {
        return { ...base, action: 'blocked', reason: 'growing', progress: farmGrowth(rules, station) };
      }
      if (!hasSpace(p)) return { ...base, action: 'blocked', reason: 'full', item: station.output[0] };
      return {
        ...base, action: 'harvest', hold: true, item: station.output[0],
        left: station.output.length, progress: station.progress / machine.harvestSeconds,
      };
    }
    if (machine.kind === 'generator') {
      const slot = p.inventory.findIndex((it) => it !== null && canAccept(rules, station, it));
      if (slot !== -1) return { ...base, action: 'deposit', slot, item: p.inventory[slot] };
      return { ...base, action: 'blocked', reason: 'status' };
    }
    if (machine.kind === 'storage') {
      // E: 든 물건 넣기 > 비어 있는 손으로 가장 많은 품목 꺼내기
      const slot = p.inventory.findIndex((it) => it !== null && canAccept(rules, station, it));
      if (slot !== -1) return { ...base, action: 'store', slot, item: p.inventory[slot] };
      const top = mostStocked(station);
      if (top && hasSpace(p)) return { ...base, action: 'unstore', item: top };
      return { ...base, action: 'blocked', reason: top ? 'full' : 'storage-empty' };
    }
    if (machine.kind === 'splitter' || machine.kind === 'merger' || machine.kind === 'inserter' || machine.kind === 'gate' ||
      machine.kind === 'reader' || machine.kind === 'bundler') {
      return { ...base, action: 'blocked', reason: 'status' };
    }
    if (machine.kind === 'machine' || machine.kind === 'supply') {
      if (station.output.length > 0 && hasSpace(p)) return { ...base, action: 'take', item: station.output[0] };
      const slot = p.inventory.findIndex((it) => it !== null && canAccept(rules, station, it));
      if (slot !== -1) return { ...base, action: 'deposit', slot, item: p.inventory[slot] };
      if (station.output.length > 0) return { ...base, action: 'blocked', reason: 'full' };
      return { ...base, action: 'blocked', reason: 'status' };
    }
    if (machine.kind === 'source') {
      return hasSpace(p)
        ? { ...base, action: 'gather', hold: true, item: station.item, progress: station.progress / machine.seconds }
        : { ...base, action: 'blocked', reason: 'full', item: station.item };
    }
  }

  const ground = groundItemAt(world, tile.x, tile.y);
  if (ground) {
    return hasSpace(p)
      ? { action: 'pickup', tile, item: ground.item }
      : { action: 'blocked', reason: 'full', tile, item: ground.item };
  }
  return { action: 'idle', tile };
}

/** Q 로 내려놓을 수 있는가. 가장 마지막에 든 물건부터 내려놓는다. */
export function findDrop(world, rules) {
  const p = world.player;
  let slot = -1;
  for (let i = p.inventory.length - 1; i >= 0; i--) if (p.inventory[i] !== null) { slot = i; break; }
  if (slot === -1) return null;
  const tile = facingTile(p, rules.game.player.reach);
  const st = stationAt(world, tile.x, tile.y);
  if (st) {
    // 벨트 위에는 내려놓으면 벨트에 올라간다. 다른 기계 칸에는 못 내려놓는다.
    const onBelt = rules.machines[st.type].kind === 'belt' && canInsertAt(st.items, 0.5);
    return onBelt ? { slot, tile, item: p.inventory[slot], belt: st } : null;
  }
  if (isSolid(world.grid, tile.x, tile.y) || groundItemAt(world, tile.x, tile.y)) return null;
  return { slot, tile, item: p.inventory[slot] };
}

function giveItem(world, item) {
  const slot = freeSlot(world.player);
  if (slot === -1) return false;
  world.player.inventory[slot] = item;
  noteTutorial(world, 'have', item);
  return true;
}

function doInstant(world, rules, act) {
  const p = world.player;
  switch (act.action) {
    case 'take':
      act.station.output.shift();
      giveItem(world, act.item);
      noteTutorial(world, 'took', act.station.type);
      return true;
    case 'deposit':
      act.station.contents.push(act.item);
      noteTutorial(world, 'placed', act.item);
      p.inventory[act.slot] = null;
      return true;
    case 'sell':
      p.inventory[act.slot] = null;
      receiveAtCounter(world, rules, act.item, act.station);
      return true;
    case 'store':
      p.inventory[act.slot] = null;
      store(act.station, act.item);
      return true;
    case 'unstore':
      takeFromStorage(act.station, act.item);
      giveItem(world, act.item);
      return true;
    case 'belt-take':
      act.station.items.shift();
      giveItem(world, act.item);
      return true;
    case 'belt-put':
      p.inventory[act.slot] = null;
      insertSorted(act.station.items, makeBeltItem(act.station, act.item, 0.5, p));
      return true;
    case 'pickup':
      world.groundItems = world.groundItems.filter((g) => !(g.x === act.tile.x && g.y === act.tile.y));
      giveItem(world, act.item);
      return true;
    default:
      return false;
  }
}

function doHold(world, rules, act, dt) {
  if (act.action === 'work') {
    const done = advanceWork(rules, act.station, dt);
    if (done) {
      recordRecipe(world, done);
      world.events.push({ type: 'crafted', item: act.station.output[0], x: act.station.x, y: act.station.y });
    }
    return true;
  }
  if (act.action === 'harvest') {
    const s = act.station;
    s.active = true;
    s.progress += dt;
    if (s.progress + 1e-9 >= act.machine.harvestSeconds) {
      s.progress = 0;
      giveItem(world, s.output.shift());
      world.events.push({ type: 'harvested', item: act.item, x: s.x, y: s.y });
    }
    return true;
  }
  if (act.action === 'gather') {
    const s = act.station;
    s.active = true;
    s.progress += dt;
    if (s.progress + 1e-9 >= act.machine.seconds) {
      s.progress = 0;
      giveItem(world, s.item);
      record(world, 'produced', s.item);
      world.events.push({ type: 'gathered', item: s.item, x: s.x, y: s.y });
    }
    return true;
  }
  return false;
}

/**
 * @param input {{ interactPressed, interactHeld, dropPressed }}
 */
export function updateInteraction(world, rules, input, dt) {
  const p = world.player;
  p.working = false;
  for (const s of world.stations) s.active = false;

  if (input.dropPressed) {
    const drop = findDrop(world, rules);
    if (drop) {
      p.inventory[drop.slot] = null;
      if (drop.belt) insertSorted(drop.belt.items, makeBeltItem(drop.belt, drop.item, 0.5, p));
      else world.groundItems.push({ x: drop.tile.x, y: drop.tile.y, item: drop.item });
    }
  }

  // 누른 순간: 즉시 동작(꺼내기/올리기/납품/줍기). 한 번 누름에 한 번만.
  if (input.interactPressed) {
    doInstant(world, rules, findInteraction(world, rules));
  }
  // 누르고 있는 동안: 작업 진행. 재료를 올린 직후 계속 누르고 있으면 바로 작업이 이어진다.
  if (input.interactHeld) {
    const act = findInteraction(world, rules);
    if (act.hold) p.working = doHold(world, rules, act, dt);
  }
}
