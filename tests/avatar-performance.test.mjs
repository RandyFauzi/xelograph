import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3 } from 'three';
import { createStaticAvatar } from '../src/game/staticAvatar.mjs';
test('Stationary avatars share geometry, keep independent colors, and need fewer than ten draws', async () => {
  const bytes = readFileSync(new URL('../public/models/avatar.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const a = createStaticAvatar(scene, {
      hair: 'short',
      outfitColor: '#367fcb',
      skinColor: '#c78e65',
    }),
    b = createStaticAvatar(scene, { hair: 'short', outfitColor: '#e39465', skinColor: '#79513b' });
  assert.ok(a.children.length < 10);
  assert.equal(a.children.length, b.children.length);
  for (let i = 0; i < a.children.length; i++) {
    assert.equal(a.children[i].geometry, b.children[i].geometry);
    assert.notEqual(a.children[i].material, b.children[i].material);
  }
  assert.notEqual(
    a.getObjectByName('AvatarShirt').material.color.getHex(),
    b.getObjectByName('AvatarShirt').material.color.getHex(),
  );
  const bounds = new Box3().setFromObject(a);
  assert.ok(
    bounds.min.y >= 0 && bounds.max.y < 2,
    'Original avatar scale and feet placement survive merging',
  );
  for (const hair of ['bob', 'cap'])
    assert.ok(
      createStaticAvatar(scene, { hair, outfitColor: '#367fcb', skinColor: '#c78e65' }).children
        .length < 10,
    );
});
