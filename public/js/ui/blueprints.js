// 청사진 목록: 브라우저에 따로 저장한다 (새 게임을 시작해도 남는다). 이름은 textContent 로만 넣는다.
import { validateBlueprint, blueprintCost, BLUEPRINT_NAME_MAX } from '../sim/blueprint.js';
import { missingCost } from '../sim/parts.js';
import { itemChip } from './icons.js';

const KEY = 'hamburger-factory:blueprints';
const MAX = 20;
const CONFIRM_MS = 3000;

function loadList(rules) {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.slice(0, MAX).map((b) => validateBlueprint(rules, b)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * @param onPaste (bp) 붙여넣기 모드 시작
 * @param onCapture () 영역 고르기 모드 시작
 * @param flash (text) 한 줄 안내
 */
export function createBlueprints({ world, rules, bank, onPaste, onCapture, flash }) {
  const $ = (id) => document.getElementById(id);
  const box = $('bp-box');
  const listEl = $('bp-list');
  const nameBox = $('bp-name-box');
  const nameInput = $('bp-name');
  let list = loadList(rules);
  let pending = null; // 이름을 기다리는 청사진
  let deleteArmed = null; // { index, until }

  function store() {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      flash('청사진 저장 실패: 브라우저 저장 공간을 쓸 수 없다');
      return false;
    }
  }

  function render() {
    box.hidden = !world.features.includes('blueprints');
    if (box.hidden) return;
    listEl.replaceChildren(...list.map((bp, i) => {
      const li = document.createElement('li');
      li.className = 'bp';
      const name = document.createElement('span');
      name.className = 'bp-name';
      name.textContent = `${bp.name} · ${bp.w}×${bp.h} · 기계 ${bp.entries.length}`;
      const cost = document.createElement('span');
      cost.className = 'bp-cost';
      const need = blueprintCost(rules, bp);
      const missing = missingCost(world, rules, need);
      for (const [id, n] of Object.entries(need)) {
        const c = itemChip(bank, rules, id, missing[id] ? `${n} · 부족 -${missing[id]}` : String(n));
        if (missing[id]) c.classList.add('is-short');
        cost.append(c);
      }
      const actions = document.createElement('div');
      actions.className = 'bp-actions';
      const paste = document.createElement('button');
      paste.type = 'button';
      paste.textContent = '붙여넣기';
      paste.addEventListener('click', () => onPaste(bp));
      const del = document.createElement('button');
      del.type = 'button';
      const armed = deleteArmed?.index === i && performance.now() < deleteArmed.until;
      del.textContent = armed ? '정말 삭제' : '삭제';
      del.addEventListener('click', () => {
        if (deleteArmed?.index === i && performance.now() < deleteArmed.until) {
          list.splice(i, 1);
          deleteArmed = null;
          store();
        } else {
          deleteArmed = { index: i, until: performance.now() + CONFIRM_MS };
          setTimeout(render, CONFIRM_MS + 50);
        }
        render();
      });
      actions.append(paste, del);
      li.append(name, cost, actions);
      return li;
    }));
    $('btn-bp-capture').disabled = list.length >= MAX;
    $('btn-bp-capture').textContent = list.length >= MAX ? `청사진은 ${MAX}개까지` : '영역 저장';
  }

  function closeName() {
    nameBox.hidden = true;
    pending = null;
  }
  function commitName() {
    if (!pending) return;
    const bp = validateBlueprint(rules, { ...pending, name: nameInput.value.trim() || nameInput.placeholder });
    closeName();
    if (!bp) {
      flash('청사진을 만들 수 없다');
      return;
    }
    list.push(bp);
    if (store()) flash(`청사진 '${bp.name}' 저장: 건설 메뉴에서 붙여넣기`);
    render();
  }
  $('bp-name-ok').addEventListener('click', commitName);
  $('bp-name-cancel').addEventListener('click', closeName);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitName(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeName(); }
  });
  $('btn-bp-capture').addEventListener('click', () => onCapture());

  return {
    render,
    /** 영역을 고른 뒤: 이름 묻기 */
    askName(bp) {
      pending = bp;
      nameInput.value = '';
      nameInput.maxLength = BLUEPRINT_NAME_MAX;
      nameInput.placeholder = `청사진 ${list.length + 1}`;
      nameBox.hidden = false;
      nameInput.focus();
    },
  };
}
