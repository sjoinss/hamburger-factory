// 플레이어 수동 작업. 바라보는 칸을 대상으로 E(누르기/길게 누르기), Q(내려놓기).
import { getOccupant, isSolid } from './grid.js';
import { stationAt } from './lookup.js';
import { canInsertAt, insertSorted, makeBeltItem } from './conveyor.js';
import { machineOf, canAccept, readyRecipe, missingInputs, advanceWork, workSeconds } from './station.js';
import { sellItem } from './economy.js';
import { noteTutorial } from './tutorial.js';

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

    if (station.output.length > 0 && machine.kind !== 'machine') {
      return hasSpace(p)
        ? { ...base, action: 'take', item: station.output[0] }
        : { ...base, action: 'blocked', reason: 'full' };
    }
    if (machine.kind === 'counter') {
      const slot = p.inventory.findIndex((it) => it !== null && canAccept(rules, station, it));
      if (slot !== -1) return { ...base, action: 'sell', slot, item: p.inventory[slot], price: rules.items[p.inventory[slot]].price };
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
      if (station.items.length > 0 && hasSpace(p)) {
        return { ...base, action: 'belt-take', item: station.items[0].item, count: station.items.length };
      }
      const slot = p.inventory.findIndex((it) => it !== null);
      if (slot !== -1 && canInsertAt(station.items, 0.5)) return { ...base, action: 'belt-put', slot, item: p.inventory[slot] };
      if (slot !== -1) return { ...base, action: 'blocked', reason: 'belt-busy' };
      return { ...base, action: 'blocked', reason: 'belt-empty' };
    }
    if (machine.kind === 'splitter' || machine.kind === 'merger' || machine.kind === 'inserter') {
      return { ...base, action: 'blocked', reason: 'status' };
    }
    if (machine.kind === 'machine') {
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
      sellItem(world, rules, act.item, act.station);
      noteTutorial(world, 'sold', act.item);
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
    if (advanceWork(rules, act.station, dt)) {
      world.events.push({ type: 'crafted', item: act.station.output[0], x: act.station.x, y: act.station.y });
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
