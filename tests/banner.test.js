// 알림 중요도: 중요한 알림이 주문 알림에 묻히지 않게
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANNER, bannerDecision } from '../public/js/ui/hud.js';

const { ROUTINE, NORMAL, IMPORTANT, NOW } = BANNER;

test('비어 있거나 사용자 조작에 대한 답이면 바로 보인다', () => {
  for (const p of [ROUTINE, NORMAL, IMPORTANT, NOW]) assert.equal(bannerDecision(null, p), 'show');
  for (const shown of [ROUTINE, IMPORTANT, NOW]) assert.equal(bannerDecision(shown, NOW), 'show');
});

test('덜 중요한 알림은 중요한 알림을 가리지 못하고 버려진다', () => {
  assert.equal(bannerDecision(IMPORTANT, ROUTINE), 'drop', '주문 완료가 장 완료를 덮지 않는다');
  assert.equal(bannerDecision(IMPORTANT, NORMAL), 'drop');
  assert.equal(bannerDecision(NORMAL, ROUTINE), 'drop');
  assert.equal(bannerDecision(ROUTINE, NORMAL), 'show');
  assert.equal(bannerDecision(ROUTINE, ROUTINE), 'show', '같은 중요도는 새것으로');
});

test('중요한 알림끼리는 줄을 선다 (너무 많으면 버림)', () => {
  assert.equal(bannerDecision(IMPORTANT, IMPORTANT, 0), 'queue');
  assert.equal(bannerDecision(NOW, IMPORTANT, 0), 'queue');
  assert.equal(bannerDecision(IMPORTANT, IMPORTANT, 4), 'drop');
  assert.equal(bannerDecision(ROUTINE, IMPORTANT), 'show');
});
