import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Render the actual TSX with Fiber's renderer, without opening a browser or using a GPU.
const sourceRoot = pathToFileURL(process.cwd() + '/src/').href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot)) {
      const url = new URL(specifier, context.parentURL);
      for (const extension of ['', '.ts', '.tsx', '.mjs'])
        if (existsSync(fileURLToPath(url) + extension))
          return { url: url.href + extension, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
    if (/\.(tsx|ts)$/.test(url) && url.startsWith(sourceRoot))
      return {
        format: 'module',
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  innerWidth: 1280,
  navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 },
  screen: { width: 1280, height: 720 },
  localStorage: { getItem: () => null },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
};
globalThis.document = { hidden: false };
globalThis.self = window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { create, act } = await import('@react-three/test-renderer');
const { useGLTF } = await import('@react-three/drei');
useGLTF.preload = () => {}; // No network requests from module-level world preloads.
const require = createRequire(import.meta.url);
const { preload } = require('suspend-react');
const { GLTFLoader: CacheLoader } = require('three-stdlib');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
const { Texture, Vector3 } = await import('three');
const { wearableAssetUrls } = await import('../src/game/wearableCatalog.mjs');
const { Character } = await import('../src/World.tsx');
const { default: AlumniCrowd } = await import('../src/game/AlumniCrowd.tsx');
const { default: AvatarAssetBoundary } = await import('../src/game/AvatarAssetBoundary.tsx');
const basic = { character: 'male', hair: 'short', skin: 'warm', outfit: 'navy' };
const custom = { ...basic, outfit: 'row4_04_halfzip_cream', eyewear: 'pixel_sunglasses' };
const assets = new Map();
for (const url of ['/models/avatar.glb', ...wearableAssetUrls(custom)]) {
  const bytes = readFileSync(new URL('../public' + url, import.meta.url));
  const result = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .register(() => ({
      name: 'GeometryOnlyTextures',
      loadTexture: () => Promise.resolve(new Texture()),
    }))
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  assets.set(url, result);
  preload(() => Promise.resolve([result]), [CacheLoader, url]);
}
const urls = wearableAssetUrls(custom);
preload(() => Promise.resolve(urls.map((url) => assets.get(url))), [CacheLoader, ...urls]);
await new Promise((resolve) => setImmediate(resolve));

test('Trying, equipping, removing and reopening real clothing keeps player and NPC render trees alive', async () => {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args);
  try {
    for (const kind of ['player', 'crowd']) {
      const view = (config) =>
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(
            React.Suspense,
            { fallback: null },
            kind === 'player'
              ? React.createElement(Character, { config, moving: { current: true } })
              : React.createElement(AlumniCrowd, {
                  alumni: [{ id: 'a', nickname: 'A', group: 'plaza', avatar: config }],
                  playing: false,
                  player: { current: new Vector3() },
                  focusId: null,
                }),
          ),
        );
      for (let opening = 0; opening < 2; opening++) {
        const renderer = await create(view(basic));
        try {
          for (let change = 0; change < 8; change++) {
            await renderer.update(view(change % 2 ? basic : custom));
            await act(() => renderer.advanceFrames(2, 0.016));
            assert.ok(renderer.scene.children.length > 0, kind + ' must remain visible');
          }
        } finally {
          await renderer.unmount();
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    console.error = original;
  }
});

test('A broken optional item retains the world and resets when another appearance is selected', async () => {
  const originalError = console.error,
    originalWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  const Broken = () => {
    throw new Error('Invalid clothing geometry');
  };
  const view = (broken) =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement('group', { name: 'campus' }),
      React.createElement(
        AvatarAssetBoundary,
        {
          appearance: broken ? 'broken' : 'valid',
          fallback: React.createElement('group', { name: 'base-avatar' }),
        },
        broken
          ? React.createElement(Broken)
          : React.createElement('group', { name: 'equipped-avatar' }),
      ),
    );
  let renderer;
  try {
    renderer = await create(view(true));
    assert.deepEqual(
      renderer.scene.children.map((child) => child.instance.name),
      ['campus', 'base-avatar'],
    );
    await renderer.update(view(false));
    assert.deepEqual(
      renderer.scene.children.map((child) => child.instance.name),
      ['campus', 'equipped-avatar'],
    );
  } finally {
    if (renderer) await renderer.unmount();
    console.error = originalError;
    console.warn = originalWarn;
  }
});
