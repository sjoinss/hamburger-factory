// 레시피북: 해금된 레시피만 보여준다. 잠긴 레시피는 개수만 알려 준다.
import { spriteIcon } from './icons.js';

function itemChip(bank, rules, id, n) {
  const span = document.createElement('span');
  span.append(spriteIcon(bank, rules.items[id].sprite));
  const label = document.createElement('span');
  label.textContent = n > 1 ? `${rules.items[id].name}×${n}` : rules.items[id].name;
  span.append(label);
  return span;
}

export function createRecipeBook({ bank, rules }) {
  const list = document.getElementById('recipe-list');
  const lockedNote = document.getElementById('recipe-locked');
  let shownKey = '';

  return {
    render(world) {
      const unlocked = new Set(world.unlocked.recipes);
      const key = [...unlocked].join(',');
      if (key === shownKey) return;
      shownKey = key;

      list.replaceChildren();
      for (const r of rules.recipes) {
        if (!unlocked.has(r.id)) continue;
        const li = document.createElement('li');
        li.className = 'recipe';

        const out = document.createElement('div');
        out.className = 'recipe-out';
        const [outId, outN] = Object.entries(r.outputs)[0];
        out.append(spriteIcon(bank, rules.items[outId].sprite));
        const name = document.createElement('span');
        name.className = 'recipe-name';
        name.textContent = outN > 1 ? `${rules.items[outId].name}×${outN}` : rules.items[outId].name;
        const where = document.createElement('span');
        where.className = 'recipe-where';
        where.textContent = `${r.stations.map((s) => rules.machines[s].name).join('/')} · ${r.verb}`;
        out.append(name, where);

        const inputs = document.createElement('div');
        inputs.className = 'recipe-in';
        Object.entries(r.inputs).forEach(([id, n], i) => {
          if (i > 0) inputs.append('+');
          inputs.append(itemChip(bank, rules, id, n));
        });

        li.append(out, inputs);
        list.append(li);
      }

      const locked = rules.recipes.length - unlocked.size;
      lockedNote.hidden = locked <= 0;
      lockedNote.textContent = `잠긴 레시피 ${locked}개`;
    },
  };
}
