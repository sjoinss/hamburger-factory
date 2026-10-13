import { readFileSync } from 'node:fs';
import { validateAll, DATA_FILES } from '../public/js/data.js';

export function readData(name) {
  return JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
}

export function loadRaw() {
  return Object.fromEntries(DATA_FILES.map((n) => [n, readData(n)]));
}

export function loadRules() {
  return validateAll(loadRaw()).rules;
}
