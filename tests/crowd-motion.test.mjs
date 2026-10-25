import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Matrix4, Vector3, ShaderLib, MeshStandardMaterial } from 'three';
import { createStaticAvatar } from '../src/game/staticAvatar.mjs';
import { AVATAR_MODELS } from '../src/game/avatarCatalog.mjs';
import { crowdPhase, sampleCrowdMotion, animateCrowdMaterial } from '../src/game/crowdMotion.mjs';

test('All six real avatar models bind hands, sleeves, face and hair to coherent idle joints without extra draw calls', async () => {
  const bytes = readFileSync(new URL('../public/models/avatar.glb', import.meta.url));
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  for (const [character, models] of Object.entries(AVATAR_MODELS))
    for (const { id: hair } of models) {
      const model = createStaticAvatar(scene, {
        character,
        hair,
        outfitColor: '#fff',
        skinColor: '#fff',
      });
      assert.ok(model.children.length < 10);
      const counts = [0, 0, 0, 0];
      let liftedHands = 0;
      for (const mesh of model.children) {
        const positions = mesh.geometry.getAttribute('position');
        const joints = mesh.geometry.getAttribute('idleJoint');
        assert.equal(joints.count, positions.count);
        for (let i = 0; i < positions.count; i++) {
          const mode = joints.getW(i);
          counts[mode]++;
          const original = new Vector3().fromBufferAttribute(positions, i);
          const pivot = new Vector3(joints.getX(i), joints.getY(i), joints.getZ(i));
          if (mode >= 2) {
            assert.ok(Math.abs(pivot.y - 1.02) < 0.01);
            assert.ok(Math.abs(Math.abs(pivot.x) - 0.34) < 0.01);
          }
          // At full wave, each rigid part keeps its dimensions and its shoulder attachment.
          const angle = mode === 2 ? 2.2 : 0;
          const moved = original
            .clone()
            .sub(pivot)
            .applyMatrix4(new Matrix4().makeRotationZ(angle))
            .add(pivot);
          assert.ok(Math.abs(moved.distanceTo(pivot) - original.distanceTo(pivot)) < 1e-6);
          assert.ok(Number.isFinite(moved.x) && moved.y < 2.1);
          if (mode === 2 && mesh.material.name === 'AvatarSkin' && moved.y > original.y + 0.3)
            liftedHands++;
          if (original.y < 0.25) assert.equal(mode, 0, 'Feet cannot be assigned to a waving joint');
        }
      }
      assert.ok(
        counts.every((n) => n > 0),
        character + ':' + hair,
      );
      assert.ok(
        liftedHands > 0,
        'Actual hand vertices rise instead of merely moving the entire avatar',
      );
    }
});

test('Crowd gestures are staggered by saved identity, bounded, continuous and disabled by reduced motion', () => {
  const phases = Array.from({ length: 100 }, (_, i) => crowdPhase('alumni-' + i));
  assert.equal(new Set(phases).size, 100);
  assert.equal(crowdPhase('saved-id'), crowdPhase('saved-id'));
  const poses = phases.map((phase) => sampleCrowdMotion(5, phase));
  assert.ok(poses.some((p) => p.right > 1) && poses.some((p) => p.right === 0));
  for (const phase of phases)
    for (let t = 0; t < 40; t += 0.1) {
      const pose = sampleCrowdMotion(t, phase),
        next = sampleCrowdMotion(t + 0.001, phase);
      assert.ok(pose.right >= 0 && pose.right <= 2.38);
      assert.ok(Math.abs(next.right - pose.right) < 0.008);
      assert.ok(Math.abs(pose.breath) <= 0.008 && Math.abs(pose.head) <= 0.14);
    }
  assert.ok(Object.values(sampleCrowdMotion(8, 1, false)).every((v) => v === 0));
});

test('Animation hooks the shipped Three standard shader and shares uniform updates without touching source materials', () => {
  const original = new MeshStandardMaterial();
  const uniforms = { time: { value: 0 }, enabled: { value: 1 } };
  const material = animateCrowdMaterial(original.clone(), uniforms);
  const shader = { uniforms: {}, vertexShader: ShaderLib.standard.vertexShader };
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.idleTime, uniforms.time);
  assert.equal(shader.uniforms.idleEnabled, uniforms.enabled);
  assert.match(shader.vertexShader, /attribute vec4 idleJoint/);
  assert.match(shader.vertexShader, /objectNormal = idleBodyRotation/);
  assert.match(shader.vertexShader, /transformed = idleJointRotation/);
  assert.ok(
    shader.vertexShader.indexOf('float idleBreath') <
      shader.vertexShader.indexOf('transformed.y +='),
  );
  assert.notEqual(original.onBeforeCompile, material.onBeforeCompile);
});
