// 튜토리얼 카드: 지금 할 일 한 줄 + 건너뛰기.
import { currentTutorialStep, tutorialStepCount, skipTutorial, restartTutorial } from '../sim/tutorial.js';

const DONE_SECONDS = 4;

export function createTutorialCard({ rules, world, onRestart }) {
  const card = document.getElementById('tutorial');
  const count = document.getElementById('tutorial-count');
  const text = document.getElementById('tutorial-text');
  const skip = document.getElementById('tutorial-skip');
  let shown = null;
  let doneTimer = 0;
  let wasActive = world.tutorial.active;
  let wasTrack = world.tutorial.track;
  let hinted = null;
  const setHint = (el) => {
    if (hinted === el) return;
    hinted?.classList.remove('is-hint');
    el?.classList.add('is-hint');
    hinted = el;
  };

  skip.addEventListener('click', () => {
    skipTutorial(world);
    card.hidden = true;
    shown = null;
  });
  document.getElementById('tutorial-restart').addEventListener('click', () => {
    restartTutorial(world);
    doneTimer = 0;
    onRestart?.();
  });

  return {
    update(realDt) {
      const t = world.tutorial;
      if (wasActive && !t.active && t.finished && wasTrack === t.track) doneTimer = DONE_SECONDS;
      wasActive = t.active;
      wasTrack = t.track;

      const step = currentTutorialStep(world, rules);
      let key;
      setHint(step?.target.ui ? document.querySelector(`.menu [data-panel="${step.target.ui}"]`) : null);
      if (step) key = `step:${t.track}:${t.step}`;
      else if (doneTimer > 0) key = 'done';
      else key = null;
      doneTimer = Math.max(0, doneTimer - realDt);

      if (key === shown) return;
      shown = key;
      card.hidden = key === null;
      card.classList.toggle('is-done', key === 'done');
      skip.hidden = key === 'done';
      if (step) {
        count.textContent = `${t.step + 1}/${tutorialStepCount(world, rules)}`;
        text.textContent = step.text;
      } else if (key === 'done') {
        count.textContent = '완료';
        text.textContent = '레시피는 레시피북에서 다시 볼 수 있다';
      }
    },
  };
}
