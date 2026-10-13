// 단계 해금: 조건을 만족하면 기계/레시피를 열고 부품을 주고, 그 단계 튜토리얼을 시작한다.
import { startTutorial } from './tutorial.js';

function stageMet(world, stage) {
  return Object.entries(stage.when.sold).every(([item, n]) => (world.stats.sold[item] ?? 0) >= n);
}

export function updateProgression(world, rules) {
  for (const stage of rules.progression.stages) {
    if (world.stagesDone.includes(stage.id) || !stageMet(world, stage)) continue;
    world.stagesDone.push(stage.id);

    const u = world.unlocked;
    for (const id of stage.unlock.machines ?? []) if (!u.machines.includes(id)) u.machines.push(id);
    for (const id of stage.unlock.recipes ?? []) if (!u.recipes.includes(id)) u.recipes.push(id);
    for (const f of stage.unlock.features ?? []) if (!world.features.includes(f)) world.features.push(f);
    const parts = stage.reward?.parts ?? {};
    for (const [id, n] of Object.entries(parts)) world.parts[id] = (world.parts[id] ?? 0) + n;

    if (stage.tutorial) startTutorial(world, stage.tutorial);
    world.events.push({ type: 'unlocked', stage: stage.id, machines: stage.unlock.machines ?? [], parts });
  }
}
