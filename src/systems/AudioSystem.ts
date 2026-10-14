/**
 * Fully procedural Web Audio: rotor hum (pitch follows speed/effort), pickup
 * and delivery chimes, bump thud, boost whoosh, low-time ticks, UI clicks.
 * The context is created lazily on the first user gesture.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private reverbSend!: GainNode;
  private rotorGain!: GainNode;
  private rotorOsc1!: OscillatorNode;
  private rotorOsc2!: OscillatorNode;
  private rotorFilter!: BiquadFilterNode;
  private rotorAm!: GainNode;
  private rotorLfo!: OscillatorNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private draftGain!: GainNode;
  private draftFilter!: BiquadFilterNode;
  private noiseBuffer!: AudioBuffer;
  private rotorOn = false;
  muted = false;

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.build();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  private build(): void {
    const ctx = this.ctx!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    // generated impulse response for a small, bright reverb on chimes
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.32;
    this.reverbSend.connect(conv).connect(this.master);

    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Rotor: two detuned saws -> lowpass, amplitude-modulated at blade-pass rate
    this.rotorGain = ctx.createGain();
    this.rotorGain.gain.value = 0;
    this.rotorFilter = ctx.createBiquadFilter();
    this.rotorFilter.type = 'lowpass';
    this.rotorFilter.frequency.value = 900;
    this.rotorFilter.Q.value = 2.5;
    this.rotorAm = ctx.createGain();
    this.rotorAm.gain.value = 0.7;
    this.rotorOsc1 = ctx.createOscillator();
    this.rotorOsc1.type = 'sawtooth';
    this.rotorOsc1.frequency.value = 110;
    this.rotorOsc2 = ctx.createOscillator();
    this.rotorOsc2.type = 'sawtooth';
    this.rotorOsc2.frequency.value = 111.5;
    this.rotorLfo = ctx.createOscillator();
    this.rotorLfo.frequency.value = 44;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.3;
    this.rotorLfo.connect(lfoDepth).connect(this.rotorAm.gain);
    this.rotorOsc1.connect(this.rotorFilter);
    this.rotorOsc2.connect(this.rotorFilter);
    this.rotorFilter.connect(this.rotorAm).connect(this.rotorGain).connect(this.master);

    // wind / air rush layer that grows with speed
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 600;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    // slipstream: a narrow whistling air band whose pitch rises as the draft meter fills
    this.draftFilter = ctx.createBiquadFilter();
    this.draftFilter.type = 'bandpass';
    this.draftFilter.frequency.value = 700;
    this.draftFilter.Q.value = 6;
    this.draftGain = ctx.createGain();
    this.draftGain.gain.value = 0;
    wind.connect(this.draftFilter).connect(this.draftGain).connect(this.master);

    this.rotorOsc1.start();
    this.rotorOsc2.start();
    this.rotorLfo.start();
    wind.start();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  setRotor(on: boolean): void {
    this.rotorOn = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rotorGain.gain.setTargetAtTime(on ? 0.085 : 0, t, 0.25);
    if (!on) {
      this.windGain.gain.setTargetAtTime(0, t, 0.2);
      this.draftGain.gain.setTargetAtTime(0, t, 0.1);
    }
  }

  /** speed01: 0..1 of top speed, effort: 0..1 throttle, boosting adds whine. */
  updateRotor(speed01: number, effort: number, boosting: boolean, altitude01: number, headwind = 0): void {
    if (!this.ctx || !this.rotorOn) return;
    const t = this.ctx.currentTime;
    const base = 88 + speed01 * 60 + effort * 26 + (boosting ? 40 : 0) + altitude01 * 6;
    this.rotorOsc1.frequency.setTargetAtTime(base, t, 0.08);
    this.rotorOsc2.frequency.setTargetAtTime(base * 1.013 + 1.5, t, 0.08);
    this.rotorLfo.frequency.setTargetAtTime(base * 0.42, t, 0.08);
    this.rotorFilter.frequency.setTargetAtTime(600 + speed01 * 1300 + (boosting ? 900 : 0), t, 0.1);
    this.rotorGain.gain.setTargetAtTime(0.07 + effort * 0.03 + (boosting ? 0.03 : 0), t, 0.15);
    // high wind above the roofs: a louder, lower, gusting rush
    const gust = headwind * (0.06 + 0.03 * Math.sin(t * 2.3) * Math.sin(t * 0.9));
    this.windGain.gain.setTargetAtTime(Math.pow(speed01, 1.6) * 0.16 + gust, t, 0.2);
    this.windFilter.frequency.setTargetAtTime(400 + speed01 * 1400 - headwind * 200, t, 0.2);
  }

  /** Slipstream layer: intensity 0..1 sets loudness, meter level 0..1 sets the rising pitch. */
  setDraft(intensity: number, level: number): void {
    if (!this.ctx || !this.rotorOn) return;
    const t = this.ctx.currentTime;
    this.draftGain.gain.setTargetAtTime(intensity * 0.22, t, 0.12);
    this.draftFilter.frequency.setTargetAtTime(700 + level * 1500 + intensity * 300, t, 0.1);
  }

  /** Meter quarter reached: a short rising blip (higher each step). */
  slipTick(step: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const f = 587.33 * Math.pow(2, (step * 3) / 12);
    this.tone(f, t, 0.12, 'triangle', 0.05, 0.2, f * 1.06);
  }

  /**
   * Meter full: a bright upward whoosh and a chime that climbs a whole tone per chain step, gets louder and adds one
   * more arpeggio note per step (x1 two notes, x5 six).
   */
  slipPayout(chain: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const c = Math.min(chain, 5);
    const lift = Math.pow(2, ((c - 1) * 2) / 12);
    const g = 1 + (c - 1) * 0.12;
    this.noise(t, 0.4 + c * 0.05, 0.09 * g, 'bandpass', 900, 4200 + c * 500, 2);
    this.tone(880 * lift, t + 0.02, 0.3, 'triangle', 0.1 * g, 0.4);
    this.tone(1318.5 * lift, t + 0.1, 0.45, 'sine', 0.12 * g, 0.5);
    const arp = [1760, 2217.5, 2637, 3520];
    for (let i = 0; i < c - 1; i++) this.tone(arp[i] * lift * 0.5, t + 0.17 + i * 0.06, 0.3, 'sine', 0.07 * g, 0.5);
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, reverb = 0.6, glideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(this.sfx);
    if (reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverbSend);
    }
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, start);
    f.frequency.exponentialRampToValueAtTime(f1, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(start, Math.random() * 1.5);
    src.stop(start + dur + 0.05);
  }

  pickup(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const notes = [659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.tone(n, t + i * 0.07, 0.5, 'sine', 0.22);
      this.tone(n * 2, t + i * 0.07, 0.25, 'triangle', 0.05);
    });
    this.noise(t, 0.25, 0.05, 'highpass', 4000, 9000);
  }

  deliver(combo: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const lift = Math.pow(2, Math.min(combo, 5) / 12);
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5].map((n) => n * lift);
    chord.forEach((n, i) => {
      this.tone(n, t + i * 0.055, 0.9, 'sine', 0.2);
      this.tone(n * 1.5, t + i * 0.055 + 0.02, 0.4, 'triangle', 0.04);
    });
    this.tone(130.8 * lift, t, 0.5, 'sine', 0.25, 0.2);
    this.noise(t + 0.05, 0.6, 0.06, 'highpass', 6000, 12000);
  }

  bump(strength: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const s = Math.min(1, strength / 14);
    this.tone(140, t, 0.28, 'sine', 0.25 + s * 0.4, 0, 45);
    this.noise(t, 0.18 + s * 0.12, 0.12 + s * 0.25, 'lowpass', 1600, 200, 0.8);
    this.tone(2400 + Math.random() * 600, t, 0.05, 'square', 0.02 * s, 0);
  }

  /** Hard crash: a heavy crunch plus a falling two-note "lost it" cue (lower still when a combo breaks). */
  crash(strength: number, comboBroken: boolean): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const s = Math.min(1, strength);
    this.tone(95, t, 0.45, 'sine', 0.55 + s * 0.3, 0.1, 38);
    this.noise(t, 0.32 + s * 0.2, 0.35 + s * 0.25, 'lowpass', 2400, 160, 0.9);
    this.noise(t + 0.02, 0.12, 0.08 + s * 0.06, 'bandpass', 3800, 1800, 3);
    const base = comboBroken ? 392 : 466.16;
    this.tone(base, t + 0.12, 0.22, 'triangle', 0.1, 0.3);
    this.tone(base * 0.749, t + 0.26, 0.4, 'triangle', 0.11, 0.4, base * 0.7);
  }

  boost(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.55, 0.16, 'bandpass', 400, 2600, 1.2);
    this.tone(220, t, 0.4, 'sawtooth', 0.03, 0, 440);
  }

  tick(urgent: boolean): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(urgent ? 1480 : 1175, t, 0.07, 'square', urgent ? 0.06 : 0.045, 0.1);
  }

  click(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(880, t, 0.06, 'triangle', 0.08, 0.1);
  }

  /**
   * Medal won: a short three-note fanfare (a soft brass-like square plus a sine body) that ends on a held chord with
   * a bell shimmer. Each higher medal starts a whole tone higher and adds one bell. `delay` lines it up with the banner.
   */
  medal(tier: number, delay = 0): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + delay;
    const lift = Math.pow(2, ((Math.min(tier, 4) - 1) * 2) / 12);
    const motif = [392, 523.25, 659.25];
    motif.forEach((n, i) => {
      const dur = i === 2 ? 1.1 : 0.16;
      this.tone(n * lift, t + i * 0.12, dur, 'square', 0.035, 0.4);
      this.tone(n * lift, t + i * 0.12, dur, 'sine', 0.16, 0.5);
    });
    this.tone(783.99 * lift, t + 0.24, 1.1, 'sine', 0.1, 0.6);
    this.tone(196 * lift, t + 0.24, 0.9, 'sine', 0.18, 0.2);
    const bells = [2093, 2637, 3136, 4186];
    for (let i = 0; i < Math.min(tier, 4); i++) this.tone(bells[i] * lift * 0.5, t + 0.32 + i * 0.07, 0.6, 'sine', 0.05, 0.7);
    this.noise(t + 0.24, 0.7, 0.04, 'highpass', 6000, 11000);
  }

  gameOver(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    [523.25, 415.3, 349.23, 261.63].forEach((n, i) => this.tone(n, t + i * 0.16, 0.7, 'triangle', 0.14));
  }

  start(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((n, i) => this.tone(n, t + i * 0.06, 0.4, 'triangle', 0.1));
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  dispose(): void {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
