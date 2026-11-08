// All sound is synthesized with the Web Audio API: effects, room ambience and the lounge music.

export type Sfx = 'move' | 'select' | 'open' | 'close' | 'blip' | 'error' | 'door' | 'talk' | 'save' | 'chime' | 'step';
export type Ambience = 'hum' | 'lounge' | 'garden' | 'library' | 'lab' | 'crowd' | 'plaza' | 'quiet' | 'studio' | 'none';

interface Running {
  stop: () => void;
}

const MIDI = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private ambGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private amb: Running | null = null;
  private music: Running | null = null;
  private ambType: Ambience = 'none';
  private wantMusic = false;
  settings = { volume: 0.55, muted: false, music: true, ambience: true };

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture at least once. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.ambGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.master);
        this.ambGain.connect(this.master);
        this.musicGain.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.sfxGain.gain.value = 0.9;
        this.ambGain.gain.value = 0.5;
        this.musicGain.gain.value = 0.45;
        const len = this.ctx.sampleRate * 2;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolume();
        const pending = this.ambType;
        this.ambType = 'none';
        this.setAmbience(pending);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // Audio is optional.
    }
  }

  applySettings(s: Partial<AudioEngine['settings']>): void {
    this.settings = { ...this.settings, ...s };
    this.applyVolume();
    this.refreshMusic();
    if (this.ctx) {
      const t = this.ambType;
      this.ambType = 'none';
      this.setAmbience(t);
    }
  }

  private applyVolume(): void {
    if (!this.ctx) return;
    const v = this.settings.muted ? 0 : this.settings.volume;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, at = 0, slideTo?: number): void {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, freq: number, gain: number, at = 0, dest?: AudioNode, type: BiquadFilterType = 'lowpass'): void {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t0 = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(dest ?? this.sfxGain);
    s.start(t0, Math.random());
    s.stop(t0 + dur + 0.02);
  }

  sfx(name: Sfx): void {
    if (!this.ctx || this.settings.muted) return;
    switch (name) {
      case 'move':
        this.tone(660, 0.035, 'square', 0.035);
        break;
      case 'select':
        this.tone(880, 0.05, 'square', 0.05);
        this.tone(1320, 0.08, 'square', 0.04, 0.05);
        break;
      case 'open':
        this.tone(440, 0.12, 'triangle', 0.12, 0, 880);
        break;
      case 'close':
        this.tone(660, 0.1, 'triangle', 0.1, 0, 330);
        break;
      case 'blip':
        this.tone(520, 0.05, 'square', 0.05);
        this.tone(780, 0.07, 'square', 0.04, 0.045);
        break;
      case 'error':
        this.tone(170, 0.16, 'sawtooth', 0.05, 0, 120);
        break;
      case 'door':
        this.noise(0.25, 900, 0.18);
        this.tone(220, 0.18, 'sine', 0.08, 0.02, 150);
        break;
      case 'talk':
        this.tone(420 + Math.random() * 180, 0.03, 'square', 0.025);
        break;
      case 'save':
        [72, 76, 79, 84].forEach((n, i) => this.tone(MIDI(n), 0.14, 'triangle', 0.08, i * 0.07));
        break;
      case 'chime':
        this.tone(MIDI(84), 0.6, 'sine', 0.07);
        this.tone(MIDI(91), 0.5, 'sine', 0.04, 0.02);
        break;
      case 'step':
        this.noise(0.03, 500, 0.03);
        break;
    }
  }

  setAmbience(type: Ambience): void {
    if (type === this.ambType && this.amb) return;
    this.amb?.stop();
    this.amb = null;
    this.ambType = type;
    this.refreshMusic();
    const c = this.ctx;
    if (!c || !this.settings.ambience || type === 'none') return;
    const nodes: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, c.currentTime, 0.6);
    out.connect(this.ambGain);
    const osc = (freq: number, gain: number, type: OscillatorType = 'sine') => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g).connect(out);
      o.start();
      nodes.push(o);
    };
    const bed = (freq: number, gain: number, ftype: BiquadFilterType = 'lowpass', q = 0.7) => {
      if (!this.noiseBuf) return;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = ftype;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = gain;
      s.connect(f).connect(g).connect(out);
      s.start();
      nodes.push(s);
    };
    const every = (ms: number, jitter: number, fn: () => void) => {
      const tick = () => {
        fn();
        timers.push(window.setTimeout(tick, ms + Math.random() * jitter));
      };
      timers.push(window.setTimeout(tick, Math.random() * ms));
    };
    switch (type) {
      case 'hum':
        osc(55, 0.03);
        osc(110.4, 0.012);
        bed(300, 0.02);
        every(4000, 6000, () => this.ctx && this.tone(1200 + Math.random() * 600, 0.04, 'sine', 0.012));
        break;
      case 'lab':
        osc(60, 0.035);
        osc(1900, 0.0025);
        bed(250, 0.025);
        every(1500, 3000, () => this.ctx && this.tone(900 + Math.random() * 900, 0.03, 'square', 0.01));
        break;
      case 'library':
        bed(400, 0.012);
        every(1000, 0, () => this.noise(0.02, 3000, 0.02, 0, out, 'highpass'));
        break;
      case 'lounge':
        bed(500, 0.03);
        every(120, 500, () => Math.random() < 0.5 && this.noise(0.03 + Math.random() * 0.04, 1800, 0.05 + Math.random() * 0.05, 0, out, 'bandpass'));
        break;
      case 'garden': {
        const h = new Date().getHours();
        bed(700, 0.015, 'bandpass', 0.5);
        if (h >= 19 || h < 7) every(900, 1600, () => [0, 0.06, 0.12].forEach((d) => this.ctx && this.tone(4200, 0.03, 'sine', 0.008, d)));
        else every(2500, 4000, () => this.ctx && this.tone(2400 + Math.random() * 800, 0.08, 'sine', 0.012, 0, 3000));
        break;
      }
      case 'crowd':
        bed(600, 0.04, 'bandpass', 0.6);
        bed(200, 0.02);
        break;
      case 'plaza':
        bed(1200, 0.02, 'bandpass', 0.4);
        bed(350, 0.015);
        break;
      case 'studio':
      case 'quiet':
      default:
        bed(300, 0.01);
    }
    this.amb = {
      stop: () => {
        timers.forEach((t) => clearTimeout(t));
        try {
          out.gain.setTargetAtTime(0, c.currentTime, 0.2);
          nodes.forEach((n) => n.stop(c.currentTime + 0.8));
        } catch {
          // already stopped
        }
      },
    };
  }

  toggleMusic(): boolean {
    this.settings.music = !this.settings.music;
    this.refreshMusic();
    return this.settings.music;
  }

  private refreshMusic(): void {
    this.wantMusic = this.settings.music && (this.ambType === 'lounge' || this.ambType === 'garden');
    if (!this.ctx) return;
    if (this.wantMusic && !this.music) this.music = this.startMusic();
    if (!this.wantMusic && this.music) {
      this.music.stop();
      this.music = null;
    }
  }

  /** Slow, warm chord loop with an occasional plucked note. Original, generated live. */
  private startMusic(): Running {
    const c = this.ctx!;
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, c.currentTime, 1.5);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const delay = c.createDelay();
    delay.delayTime.value = 0.38;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    out.connect(lp);
    lp.connect(this.musicGain);
    lp.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(this.musicGain);
    const chords = [
      [50, 57, 61, 66],
      [47, 54, 57, 62],
      [43, 50, 54, 59],
      [45, 52, 57, 61],
    ];
    let step = 0;
    const timers: number[] = [];
    const playChord = () => {
      const t = c.currentTime + 0.05;
      const notes = chords[step % chords.length];
      notes.forEach((n, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = i === 0 ? 'triangle' : 'sine';
        o.frequency.value = MIDI(n + 12);
        o.detune.value = (Math.random() - 0.5) * 8;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(i === 0 ? 0.05 : 0.03, t + 1.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.6);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 4.8);
      });
      for (let k = 0; k < 4; k++) {
        if (Math.random() < 0.55) {
          const n = notes[Math.floor(Math.random() * notes.length)] + 24 + (Math.random() < 0.3 ? 12 : 0);
          const tt = t + 0.6 + k * 0.9 + Math.random() * 0.2;
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'triangle';
          o.frequency.value = MIDI(n);
          g.gain.setValueAtTime(0.0001, tt);
          g.gain.exponentialRampToValueAtTime(0.035, tt + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.1);
          o.connect(g).connect(out);
          o.start(tt);
          o.stop(tt + 1.2);
        }
      }
      step++;
      timers.push(window.setTimeout(playChord, 4000));
    };
    playChord();
    return {
      stop: () => {
        timers.forEach((t) => clearTimeout(t));
        out.gain.setTargetAtTime(0, c.currentTime, 0.4);
      },
    };
  }
}

export const audio = new AudioEngine();
