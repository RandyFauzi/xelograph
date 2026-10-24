import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJumpState, stepJump } from '../src/game/jump.mjs';
test('Jump rises, falls, and lands exactly on the ground without double jumping', () => {
  let state = stepJump(createJumpState(), 1 / 60, true);
  assert.ok(state.height > 0);
  const velocity = state.velocity;
  state = stepJump(state, 1 / 60, true);
  assert.ok(state.velocity < velocity, 'A midair press cannot reset jump velocity');
  let peak = state.height;
  for (let frame = 0; frame < 120; frame++) {
    state = stepJump(state, 1 / 60);
    peak = Math.max(peak, state.height);
  }
  assert.ok(peak > 0.8 && peak < 1.3);
  assert.deepEqual(state, createJumpState());
  assert.deepEqual(stepJump(state, 1 / 60), state);
});
