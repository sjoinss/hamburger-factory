import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SPRITE_DEFS, TEMPLATE_SPRITES, paletteMap, validateSprite, rotateRows, flipRows, recolorRows } from '../public/js/render/sprites.js';
import { HAIR_COLORS, SHIRT_COLORS } from '../public/js/sprites/customers.js';
import { validatePalette } from '../public/js/data.js';
import { loadRules } from './helpers.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const palette = validatePalette(JSON.parse(read('../public/data/palette.json')));
const colors = paletteMap(palette);
const paletteHex = new Set(palette.colors.map((c) => c.hex.toLowerCase()));

test('팔레트는 32색 이하', () => {
  assert.ok(palette.colors.length <= 32);
});

test('모든 스프라이트가 사각형이고 팔레트 문자만 쓴다', () => {
  const problems = [];
  for (const [name, frames] of Object.entries(SPRITE_DEFS)) {
    const fill = TEMPLATE_SPRITES[name];
    frames.forEach((f, i) => problems.push(...validateSprite(`${name}[${i}]`, fill ? recolorRows(f, fill) : f, colors)));
  }
  assert.deepEqual(problems, []);
});

test('CSS 와 JS 에 팔레트 밖의 색이 없다', () => {
  const files = [
    '../public/css/ui.css',
    ...readdirSync(new URL('../public/js/', import.meta.url), { recursive: true })
      .filter((f) => f.endsWith('.js'))
      .map((f) => `../public/js/${f.replaceAll('\\', '/')}`),
  ];
  for (const f of files) {
    for (const hex of read(f).match(/#[0-9a-f]{6}\b/gi) ?? []) {
      assert.ok(paletteHex.has(hex.toLowerCase()), `${f}: 팔레트 밖 색 ${hex}`);
    }
  }
});

test('HTML 에 인라인 script/style 이 없다 (CSP)', () => {
  const html = read('../public/index.html');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /\sstyle=/i);
  assert.doesNotMatch(html, /<style/i);
});

test('회전 4번 = 원래 모양, 반전 2번 = 원래 모양', () => {
  const rows = SPRITE_DEFS.crate[0];
  assert.deepEqual(rotateRows(rotateRows(rotateRows(rotateRows(rows)))), rows);
  assert.deepEqual(flipRows(flipRows(rows)), rows);
});

test('data 에 적힌 스프라이트 이름이 모두 존재한다', () => {
  const rules = loadRules();
  for (const def of [...Object.values(rules.items), ...Object.values(rules.machines)]) {
    assert.ok(Object.hasOwn(SPRITE_DEFS, def.sprite), `없는 스프라이트: ${def.sprite}`);
  }
});

test('손님 머리/옷 색 후보는 모두 팔레트 안', () => {
  for (const k of HAIR_COLORS) assert.ok(k in colors, k);
  for (const [c, d] of SHIRT_COLORS) assert.ok(c in colors && d in colors, c + d);
});
