'use client';

// WebAudio sound engine — plays the original 28 mp3s and synthesized presets,
// with per-event pitch/volume, master volumes and looping music.

import type { SoundRef } from './skin';

type Ctx = AudioContext & { _unlocked?: boolean };

class SoundEngine {
  private ctx: Ctx | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicRef: SoundRef | null = null;
  sfxMaster = 0.9;
  musicMaster = 0.56;
  musicOn = false;

  ensure(): Ctx | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC() as Ctx;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolumes(sfxPct: number, musicPct: number) {
    this.sfxMaster = sfxPct / 100;
    this.musicMaster = musicPct / 100;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(
        this.musicMaster * (this.musicRef?.vol ?? 1),
        this.ctx.currentTime, 0.05,
      );
    }
  }

  private async buffer(file: string): Promise<AudioBuffer | null> {
    const ctx = this.ensure();
    if (!ctx) return null;
    if (this.buffers.has(file)) return this.buffers.get(file)!;
    try {
      const res = await fetch(`/audio/${file}.mp3`);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(data);
      this.buffers.set(file, buf);
      return buf;
    } catch {
      return null;
    }
  }

  async playFile(file: string, opts: { pitch?: number; vol?: number } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const buf = await this.buffer(file);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.pitch ?? 1;
    const gain = ctx.createGain();
    gain.gain.value = (opts.vol ?? 1) * this.sfxMaster;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }

  // ------------------------------------------------------------- synths ---

  private tone(
    ctx: AudioContext,
    type: OscillatorType,
    f0: number,
    f1: number,
    t0: number,
    dur: number,
    vol: number,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  playSynth(preset: string, vol = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const v = vol * this.sfxMaster * 0.5;
    switch (preset) {
      case 'blip':
        this.tone(ctx, 'square', 660, 880, t, 0.09, v);
        break;
      case 'pop':
        this.tone(ctx, 'sine', 380, 640, t, 0.12, v);
        break;
      case 'chime':
        this.tone(ctx, 'triangle', 523, 523, t, 0.5, v * 0.8);
        this.tone(ctx, 'triangle', 659, 659, t + 0.06, 0.5, v * 0.8);
        this.tone(ctx, 'triangle', 784, 784, t + 0.12, 0.6, v * 0.8);
        break;
      case 'zap':
        this.tone(ctx, 'sawtooth', 900, 180, t, 0.18, v);
        break;
      case 'coin':
        this.tone(ctx, 'square', 988, 988, t, 0.07, v * 0.9);
        this.tone(ctx, 'square', 1319, 1319, t + 0.08, 0.28, v * 0.9);
        break;
      case 'thud':
        this.tone(ctx, 'sine', 150, 55, t, 0.28, v * 1.2);
        break;
      case 'fanfare':
        this.tone(ctx, 'triangle', 523, 523, t, 0.16, v);
        this.tone(ctx, 'triangle', 523, 523, t + 0.17, 0.16, v);
        this.tone(ctx, 'triangle', 784, 784, t + 0.34, 0.42, v);
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------- events ---

  /** Play a configured event sound (file or synth). */
  playEvent(ref: SoundRef | undefined) {
    if (!ref) return;
    if (ref.kind === 'synth') {
      this.playSynth(ref.src, ref.vol);
    } else if (ref.kind === 'file' && ref.src) {
      void this.playFile(ref.src, { pitch: ref.pitch, vol: ref.vol });
    }
  }

  /** Line-clear sound. kind 'original' = the s1..s15 combo progression. */
  playClear(ref: SoundRef | undefined, comboPre: number) {
    if (ref && ref.kind === 'synth') {
      this.playSynth(ref.src, ref.vol);
      return;
    }
    if (ref && ref.kind === 'file' && ref.src) {
      void this.playFile(ref.src, { pitch: ref.pitch, vol: ref.vol });
      return;
    }
    const n = Math.min(15, Math.max(1, comboPre + 1));
    const file = n === 12 ? 'score' : `score/s${n}`;
    void this.playFile(file, { pitch: ref?.pitch ?? 1, vol: ref?.vol ?? 1 });
  }

  /** Cheerful praise for multi-line clears. 'original' = c2..c6 by lines. */
  playCheer(ref: SoundRef | undefined, lines: number) {
    if (ref && ref.kind === 'synth') {
      this.playSynth(ref.src, ref.vol);
      return;
    }
    if (ref && ref.kind === 'file' && ref.src) {
      void this.playFile(ref.src, { pitch: ref.pitch, vol: ref.vol });
      return;
    }
    const n = Math.min(6, Math.max(2, lines));
    void this.playFile(`cheerful/c${n}`, { pitch: ref?.pitch ?? 1, vol: (ref?.vol ?? 1) * 0.32 });
  }

  // --------------------------------------------------------------- music ---

  async startMusic(ref: SoundRef) {
    this.stopMusic();
    const ctx = this.ensure();
    if (!ctx || !ref.src) return;
    const buf = await this.buffer(ref.src);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = ref.pitch ?? 1;
    const gain = ctx.createGain();
    gain.gain.value = this.musicMaster * (ref.vol ?? 1);
    src.connect(gain).connect(ctx.destination);
    src.start();
    this.musicSrc = src;
    this.musicGain = gain;
    this.musicRef = ref;
    this.musicOn = true;
  }

  stopMusic() {
    if (this.musicSrc) {
      try { this.musicSrc.stop(); } catch { /* already stopped */ }
      this.musicSrc.disconnect();
      this.musicSrc = null;
    }
    this.musicGain = null;
    this.musicOn = false;
  }

  /** Probe duration of a file (for the library list). */
  async durationOf(file: string): Promise<number> {
    const buf = await this.buffer(file);
    return buf?.duration ?? 0;
  }
}

export const soundEngine = new SoundEngine();
