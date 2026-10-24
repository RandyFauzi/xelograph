import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutAlumni, COMMONS } from '../src/game/alumniLayout.mjs';
import { findPath } from '../src/game/navigation.mjs';
test('The commons fits 100 alumni with separated seats and navigable access', () => {
  for (const mixed of [false, true]) {
    const alumni = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      group: mixed ? ['plaza', 'crew', 'supporter'][i % 3] : 'plaza',
    }));
    const layout = layoutAlumni(alumni);
    assert.equal(layout.size, 100);
    const positions = [...layout.values()];
    for (let i = 0; i < positions.length; i++) {
      const [x, , z] = positions[i];
      assert.ok(x >= COMMONS.minX && x <= COMMONS.maxX && z >= COMMONS.minZ && z <= COMMONS.maxZ);
      for (let j = i + 1; j < positions.length; j++)
        assert.ok(
          Math.hypot(x - positions[j][0], z - positions[j][2]) > 0.8,
          'Avatars must not overlap',
        );
    }
    const [x, , z] = positions[0];
    assert.ok(
      findPath({ x: 0, z: 14 }, { x, z }, 0).length > 0,
      'Commons is accessible before finishing the survey',
    );
  }
});
