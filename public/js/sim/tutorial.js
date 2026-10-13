// 튜토리얼. 트랙(start, grill …)별로 단계가 있고, 단계 조건은 이번 트랙 동안 일어난 일(log)로만 판단한다.

export function createTutorial(track) {
  return { track, active: track !== null, step: 0, finished: false, optOut: false, log: {} };
}

/**
 * 플레이어 행동 기록.
 * 아이템 기준: have(손에 들어옴) | placed(작업대에 올림) | sold(판매)
 * 기계 기준: built(지음) | made(기계가 완성품을 냄) | took(기계에서 꺼냄)
 */
export function noteTutorial(world, kind, id) {
  const t = world.tutorial;
  if (t.active) t.log[`${kind}:${id}`] = true;
}

const stepsOf = (rules, t) => (t.track ? rules.tutorial[t.track] ?? [] : []);

/** 조건을 만족한 단계는 순서대로 넘어간다 (순서를 바꿔 해도 막히지 않게). */
export function updateTutorial(world, rules) {
  const t = world.tutorial;
  if (!t.active) return;
  const steps = stepsOf(rules, t);
  while (t.step < steps.length) {
    const [kind, id] = Object.entries(steps[t.step].done)[0];
    if (!t.log[`${kind}:${id}`]) break;
    t.step += 1;
  }
  if (t.step >= steps.length) {
    t.active = false;
    t.finished = true;
  }
}

export function currentTutorialStep(world, rules) {
  const t = world.tutorial;
  return t.active ? stepsOf(rules, t)[t.step] ?? null : null;
}

export function tutorialStepCount(world, rules) {
  return stepsOf(rules, world.tutorial).length;
}

/** 단계가 가리키는 작업대 (화살표 표시용). UI 대상이거나 아직 없으면 null. */
export function tutorialTarget(world, rules) {
  const step = currentTutorialStep(world, rules);
  if (!step || !step.target.station) return null;
  const { station, item } = step.target;
  return world.stations.find((s) => s.type === station && (item === undefined || s.item === item)) ?? null;
}

/** 새 트랙 시작. 건너뛰기를 한 플레이어에게는 다음 트랙도 띄우지 않는다. */
export function startTutorial(world, track) {
  const optOut = world.tutorial.optOut;
  world.tutorial = createTutorial(track);
  world.tutorial.optOut = optOut;
  if (optOut) world.tutorial.active = false;
}

export function skipTutorial(world) {
  world.tutorial.active = false;
  world.tutorial.optOut = true;
}

/** 지금(또는 마지막) 트랙을 처음부터 다시 */
export function restartTutorial(world) {
  world.tutorial = createTutorial(world.tutorial.track ?? 'start');
}
