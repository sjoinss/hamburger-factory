// 전력: 기본 전력(도시 전기) + 발전기 출력 vs 돌아가는 기계들의 소비.
// 모자라면 모든 기계가 같은 비율만큼 느려진다 (일부만 꺼지지 않는다).
import { zoneMult } from './zones.js';
import { powerMult } from './upgrade.js';

export function createPower() {
  return { supply: 0, demand: 0, ratio: 1 };
}

/** 지난 틱에 실제로 돌아간 기계만 전기를 쓴다 */
function drawing(rules, st) {
  const kind = rules.machines[st.type].kind;
  if (kind === 'belt') return st.items.length > 0;
  if (kind === 'splitter' || kind === 'merger' || kind === 'sorter') return st.buffer !== null;
  return st.status === 'running';
}

/** 발전기 한 틱: 연료를 태우는 동안 출력. @returns 이번 틱 출력 kW */
function burn(world, rules, gen, dt) {
  const m = rules.machines[gen.type];
  if (gen.fuelLeft <= 0) {
    const fuel = gen.contents.find((id) => Object.hasOwn(m.fuels, id));
    if (!fuel) {
      gen.status = 'idle';
      return 0;
    }
    gen.contents.splice(gen.contents.indexOf(fuel), 1);
    gen.fuelLeft = m.fuels[fuel];
  }
  gen.fuelLeft -= dt;
  gen.status = 'running';
  gen.active = true;
  return m.output * zoneMult(world, rules, gen, 'generator');
}

export function updatePower(world, rules, dt) {
  const p = world.power;
  if (!world.features.includes('power')) {
    p.supply = 0;
    p.demand = 0;
    p.ratio = 1;
    return;
  }
  let supply = rules.zones.basePower;
  let demand = 0;
  for (const st of world.stations) {
    const m = rules.machines[st.type];
    if (m.kind === 'generator') supply += burn(world, rules, st, dt);
    else if (m.power && drawing(rules, st)) demand += m.power * powerMult(rules, st);
  }
  p.supply = supply;
  p.demand = demand;
  p.ratio = demand <= supply ? 1 : supply / demand;
}
