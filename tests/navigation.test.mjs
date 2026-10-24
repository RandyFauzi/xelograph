import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findPath,
  isWalkable,
  moveWithCollision,
  inputDirection,
  MISSION_ZONES,
  WORLD_BOUNDS,
} from '../src/game/navigation.mjs';
test('All seven missions can be reached in sequence through the expanded world', () => {
  let start = { x: 0, z: 14 };
  for (let i = 0; i < MISSION_ZONES.length; i++) {
    const [x, z] = MISSION_ZONES[i],
      path = findPath(start, { x, z }, i);
    assert.ok(path.length > 0, 'Path to mission ' + (i + 1));
    for (const point of path)
      assert.ok(isWalkable(point.x, point.z, i), 'Path avoids barriers and scenery');
    assert.deepEqual(path.at(-1), { x, z });
    start = { x, z };
  }
});
test('Future mission areas unlock one at a time; open gardens remain accessible', () => {
  for (let i = 1; i < MISSION_ZONES.length; i++) {
    const [x, z] = MISSION_ZONES[i];
    assert.equal(isWalkable(x, z, i - 1), false);
    assert.deepEqual(findPath({ x: 0, z: 14 }, { x, z }, i - 1), []);
    assert.equal(isWalkable(x, z, i), true);
  }
  assert.equal(isWalkable(-19, 0, 0), true);
  assert.equal(isWalkable(19, -8, 0), true);
  assert.ok(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX >= 48);
});
test('Keyboard and analog movement are camera-relative and diagonal speed is normalized', () => {
  const front = { x: 0, z: -1 };
  assert.deepEqual(inputDirection(0, -1, front), { x: 0, z: -1 });
  assert.deepEqual(inputDirection(1, 0, front), { x: 1, z: 0 });
  const turned = { x: -1, z: 0 };
  assert.deepEqual(inputDirection(0, -1, turned), { x: -1, z: 0 });
  assert.ok(Math.abs(Math.hypot(...Object.values(inputDirection(1, -1, front))) - 1) < 0.000001);
  const idle = inputDirection(0, 0, front);
  assert.equal(Math.hypot(idle.x, idle.z), 0);
});
test('Movement cannot cross school buildings, water, locked zones or world boundaries', () => {
  assert.equal(isWalkable(-6, -8), false);
  assert.equal(isWalkable(10, 6), false);
  assert.equal(isWalkable(18, 12), false);
  assert.deepEqual(moveWithCollision({ x: 24, z: 10 }, { x: 1, z: 0 }), { x: 24, z: 10 });
  const blocked = moveWithCollision({ x: -6, z: -6 }, { x: 0, z: -0.5 });
  assert.equal(blocked.z, -6);
  const open = moveWithCollision({ x: 0, z: 14 }, { x: 0, z: -0.06 }, 0);
  assert.equal(open.z, 13.94);
  const stopped = moveWithCollision(open, { x: 0, z: 0 }, 0);
  assert.deepEqual(stopped, open);
});
test('Frame-by-frame path following reaches every mission without getting stuck', () => {
  let position = { x: 0, z: 14 };
  for (let unlocked = 0; unlocked < 7; unlocked++) {
    const [x, z] = MISSION_ZONES[unlocked],
      path = findPath(position, { x, z }, unlocked);
    let frames = 0;
    while (path.length && frames++ < 6000) {
      const point = path[0],
        dx = point.x - position.x,
        dz = point.z - position.z,
        length = Math.hypot(dx, dz);
      if (length < 0.1) {
        path.shift();
        continue;
      }
      const step = Math.min(0.06, length);
      const next = moveWithCollision(
        position,
        { x: (dx / length) * step, z: (dz / length) * step },
        unlocked,
      );
      assert.ok(
        Math.hypot(next.x - position.x, next.z - position.z) > 0.00001,
        'Motor must continue moving at area ' + (unlocked + 1),
      );
      position = next;
    }
    assert.ok(frames < 6000);
    assert.ok(
      Math.hypot(position.x - x, position.z - z) < 0.15,
      'Arrives at mission ' + (unlocked + 1),
    );
  }
});
