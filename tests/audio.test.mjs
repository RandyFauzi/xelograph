import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campusAudio } from '../src/game/audio.ts';

test('Audio waits for a gesture, mutes, and resumes after a hidden tab without a catch-up burst', async () => {
  const original = { window: globalThis.window, setInterval, clearInterval };
  let context,
    constructions = 0,
    tones = 0,
    nextTimer = 0;
  const timers = new Map();
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const node = () => ({ connect() {}, disconnect() {} });
  class FakeContext {
    currentTime = 0;
    state = 'suspended';
    destination = node();
    constructor() {
      context = this;
      constructions++;
    }
    createGain() {
      return { ...node(), gain: parameter() };
    }
    createOscillator() {
      return {
        ...node(),
        frequency: parameter(),
        start() {
          tones++;
        },
        stop() {},
      };
    }
    async resume() {
      this.state = 'running';
    }
    async suspend() {
      this.state = 'suspended';
    }
  }
  globalThis.window = { AudioContext: FakeContext };
  globalThis.setInterval = (callback) => {
    const id = ++nextTimer;
    timers.set(id, callback);
    return id;
  };
  globalThis.clearInterval = (id) => timers.delete(id);
  try {
    campusAudio.configure({ enabled: false, music: 0.18, effects: 0.4 });
    await campusAudio.unlock();
    assert.equal(constructions, 0, 'Muted audio must not create a context');
    campusAudio.configure({ enabled: true, music: 0.18, effects: 0.4 });
    assert.equal(constructions, 0, 'Configuration alone must not autoplay');
    await campusAudio.unlock();
    assert.equal(constructions, 1);
    assert.equal(timers.size, 1);
    assert.ok(tones > 0);
    campusAudio.visibility(true);
    assert.equal(timers.size, 0);
    assert.equal(context.state, 'suspended');
    context.currentTime = 120;
    const beforeResume = tones;
    campusAudio.visibility(false);
    await Promise.resolve();
    assert.equal(timers.size, 1);
    assert.ok(tones - beforeResume <= 5, 'Resume must not replay missed music');
    await campusAudio.unlock();
    assert.equal(timers.size, 1, 'Repeated gestures must not duplicate the scheduler');
    campusAudio.configure({ enabled: false, music: 0.18, effects: 0.4 });
    assert.equal(timers.size, 0);
    const muted = tones;
    campusAudio.play('jump');
    campusAudio.play('success');
    assert.equal(tones, muted);
  } finally {
    campusAudio.visibility(true);
    if (original.window === undefined) delete globalThis.window;
    else globalThis.window = original.window;
    globalThis.setInterval = original.setInterval;
    globalThis.clearInterval = original.clearInterval;
  }
});
