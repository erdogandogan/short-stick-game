import assert from 'node:assert/strict';
import { canShowStartButton, canShowDrawButton } from '../utils/gameUi.js';

function test(name, fn) { try { fn(); console.log('✓', name); } catch (e) { console.error('✗', name); console.error(e); process.exitCode = 1; } }

const me = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';

// Start button
test('Start visible only to owner, not started, and all ready if provided', () => {
  assert.equal(canShowStartButton({ isStarted: false, creatorUserId: me, me, participants: [{ isReady: true }] }), true);
  assert.equal(canShowStartButton({ isStarted: false, creatorUserId: me, me, participants: [{ isReady: true }, { isReady: false }] }), false);
  assert.equal(canShowStartButton({ isStarted: true, creatorUserId: me, me }), false);
  assert.equal(canShowStartButton({ isStarted: false, creatorUserId: other, me }), false);
});

// Draw button
test('Draw hidden until started', () => {
  assert.equal(canShowDrawButton({ isStarted: false, me, participants: [], result: null }), false);
});

test('Draw visible for participant who has not drawn', () => {
  const participants = [ { userId: me, hasDrawn: false }, { userId: other, hasDrawn: false } ];
  assert.equal(canShowDrawButton({ isStarted: true, me, participants, result: { isCompleted: false } }), true);
});

test('Draw hidden after user already drew', () => {
  const participants = [ { userId: me, hasDrawn: true }, { userId: other, hasDrawn: false } ];
  assert.equal(canShowDrawButton({ isStarted: true, me, participants, result: { isCompleted: false } }), false);
});

test('Draw hidden when game completed', () => {
  const participants = [ { userId: me, hasDrawn: false } ];
  assert.equal(canShowDrawButton({ isStarted: true, me, participants, result: { isCompleted: true } }), false);
});
