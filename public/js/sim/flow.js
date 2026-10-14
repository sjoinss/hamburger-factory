// 벨트 흐름: 고른 벨트에서 물건이 흘러가는 길과, 그 길에서 물건을 받아 가는 곳(끝 저장소·출고구, 투입기가 넣는 기계).
import { conveyorNetwork, isConveyorKind } from './conveyor.js';
import { inserterTiles } from './inserter.js';
import { stationAt } from './lookup.js';

const MAX_NODES = 2000;

/** @returns {{ path: station[], ends: station[] }} (벨트류가 아니면 null) */
export function beltFlow(world, rules, start) {
  if (!start || !isConveyorKind(rules.machines[start.type].kind)) return null;
  const net = conveyorNetwork(world, rules);
  const seen = new Set([start.id]);
  const path = [start];
  for (let i = 0; i < path.length && path.length < MAX_NODES; i++) {
    const n = path[i];
    const nexts = net.next.has(n.id) ? [net.next.get(n.id)] : (net.outputs.get(n.id) ?? []).map((o) => o.node);
    for (const m of nexts) {
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        path.push(m);
      }
    }
  }
  const ends = new Map();
  for (const n of path) {
    const sink = net.sink.get(n.id);
    if (sink) ends.set(sink.id, sink);
  }
  // 길 위의 칸에서 집어 가는 투입기와, 그 투입기가 넣는 기계
  for (const ins of world.stations) {
    if (rules.machines[ins.type].kind !== 'inserter') continue;
    const { from, to } = inserterTiles(ins);
    const src = stationAt(world, from.x, from.y);
    if (!src || !seen.has(src.id)) continue;
    ends.set(ins.id, ins);
    const dst = stationAt(world, to.x, to.y);
    if (dst && !seen.has(dst.id)) ends.set(dst.id, dst);
  }
  return { path, ends: [...ends.values()] };
}
