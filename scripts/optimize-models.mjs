import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { stat } from 'node:fs/promises';
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const file = 'public/models/world.glb';
const before = (await stat(file)).size;
const document = await io.read(file);
await document.transform(dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(file, document);
console.log(
  `Campus GLB: ${before} → ${(await stat(file)).size} bytes; Meshopt decoder bundled locally.`,
);
