export type AudioPreferences = { enabled: boolean; music: number; effects: number };
export const DEFAULT_AUDIO: AudioPreferences = { enabled: true, music: 0.18, effects: 0.4 };
export function loadAudioPreferences(): AudioPreferences {
  try {
    const p = JSON.parse(localStorage.getItem('xel-audio') || 'null');
    if (
      p &&
      typeof p.enabled === 'boolean' &&
      Number.isFinite(p.music) &&
      Number.isFinite(p.effects)
    )
      return {
        enabled: p.enabled,
        music: Math.max(0, Math.min(1, p.music)),
        effects: Math.max(0, Math.min(1, p.effects)),
      };
  } catch {}
  return { ...DEFAULT_AUDIO };
}
export type SoundEffect = 'step' | 'jump' | 'land' | 'success' | 'tap';

/** Original procedural music and foley; no audio files, trackers, downloads, or autoplay. */
class CampusAudio {
  private ctx: AudioContext | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private prefs = { ...DEFAULT_AUDIO };
  private beat = 0;
  private nextBeat = 0;
  private noise: AudioBuffer | null = null;
  configure(p: AudioPreferences) {
    this.prefs = { ...p };
    const t = this.ctx?.currentTime || 0;
    this.music?.gain.setTargetAtTime(p.music, t, 0.12);
    this.effects?.gain.setTargetAtTime(p.effects, t, 0.06);
    this.master?.gain.setTargetAtTime(p.enabled ? 0.7 : 0, t, 0.08);
    if (!p.enabled && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  async unlock() {
    if (!this.prefs.enabled || typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtor) return;
        this.ctx = new AudioCtor();
        this.master = this.ctx.createGain();
        this.music = this.ctx.createGain();
        this.effects = this.ctx.createGain();
        this.music.connect(this.master);
        this.effects.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.configure(this.prefs);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      if (!this.timer && this.ctx.state === 'running') {
        this.nextBeat = this.ctx.currentTime + 0.12;
        this.timer = setInterval(() => this.schedule(), 60);
        this.schedule();
      }
    } catch {
      /* Unsupported audio must never block the journey. */
    }
  }
  visibility(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      void this.ctx.suspend().catch(() => {});
    } else if (this.prefs.enabled) void this.unlock();
  }
  private tone(
    frequency: number,
    time: number,
    duration: number,
    gain: number,
    bus: GainNode,
    type: OscillatorType = 'sine',
  ) {
    const ctx = this.ctx!;
    const oscillator = ctx.createOscillator(),
      envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
  private schedule() {
    if (!this.ctx || !this.music || !this.prefs.enabled || this.ctx.state !== 'running') return;
    const melody = [
      74,
      null,
      78,
      76,
      74,
      null,
      71,
      69,
      74,
      76,
      78,
      null,
      79,
      78,
      76,
      null,
      74,
      null,
      78,
      81,
      79,
      null,
      78,
      76,
      74,
      71,
      69,
      null,
      71,
      73,
      74,
      null,
    ];
    while (this.nextBeat < this.ctx.currentTime + 0.18) {
      const index = this.beat % 32,
        chord = Math.floor(this.beat / 4) % 4,
        root = [50, 55, 47, 57][chord],
        at = this.nextBeat;
      if (this.beat % 4 === 0)
        for (const interval of chord === 2 ? [0, 3, 7] : [0, 4, 7])
          this.tone(440 * 2 ** ((root + interval - 69) / 12), at, 3.2, 0.025, this.music, 'sine');
      if (melody[index] !== null)
        this.tone(440 * 2 ** ((melody[index]! - 69) / 12), at, 0.95, 0.12, this.music, 'sine');
      if (this.beat % 2 === 0)
        this.tone(440 * 2 ** ((root - 12 - 69) / 12), at, 1.25, 0.055, this.music, 'sine');
      this.beat++;
      this.nextBeat += 0.75;
    }
  }
  play(kind: SoundEffect) {
    if (!this.ctx || !this.effects || !this.prefs.enabled || this.ctx.state !== 'running') return;
    const ctx = this.ctx,
      t = ctx.currentTime,
      bus = this.effects;
    if (kind === 'success') {
      [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, t + i * 0.11, 0.48, 0.16, bus));
      return;
    }
    if (kind === 'tap') {
      this.tone(720, t, 0.055, 0.07, bus);
      return;
    }
    if (kind === 'jump') {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(470, t + 0.16);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 0.2);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
      return;
    }
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] =
          2 * (Math.sin(i * 127.1) * 43758.5453 - Math.floor(Math.sin(i * 127.1) * 43758.5453)) - 1;
    }
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'land' ? 420 : 700;
    gain.gain.setValueAtTime(kind === 'land' ? 0.16 : 0.075, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'land' ? 0.11 : 0.065));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    source.start(t);
    source.stop(t + 0.12);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}
export const campusAudio = new CampusAudio();
