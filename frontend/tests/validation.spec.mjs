import assert from 'node:assert/strict';
import { isGuid, canCreateGame, canJoin } from '../utils/validation.js';

function test(name, fn) {
  try { fn(); console.log('✓', name); } catch (e) { console.error('✗', name); console.error(e); process.exitCode = 1; }
}

test('isGuid true for valid GUID', () => {
  assert.equal(isGuid('123e4567-e89b-12d3-a456-426614174000'), true);
});

test('isGuid false for invalid', () => {
  assert.equal(isGuid('not-a-guid'), false);
});

test('canCreateGame fails empty', () => {
  const r = canCreateGame({ penaltyText: '', gameType: '' });
  assert.equal(r.ok, false);
});

test('canCreateGame ok when filled', () => {
  const r = canCreateGame({ penaltyText: 'kaybeden şınav çeker', gameType: 'friends' });
  assert.equal(r.ok, true);
});

test('canJoin fails for non-guid', () => {
  const r = canJoin({ code: 'abc' });
  assert.equal(r.ok, false);
});

test('canJoin ok for guid', () => {
  const r = canJoin({ code: '123e4567-e89b-12d3-a456-426614174000' });
  assert.equal(r.ok, true);
});
