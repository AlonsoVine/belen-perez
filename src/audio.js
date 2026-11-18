// Sonido sintetizado: pizzicato (Karplus-Strong), reverberación de sala y un dron de quintas al aire.
const FREQ = { G3: 196.0, D4: 293.66, A4: 440.0, E5: 659.25 };

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.cache = new Map();
  }

  init() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // reverb: respuesta al impulso generada (sala de conciertos pequeña)
    const len = ctx.sampleRate * 3.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.verb.connect(wet).connect(this.master);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.7;
    this.dry.connect(this.master);
    this.dry.connect(this.verb);

    // dron: Sol-Re muy suave, filtrado
    this.drone = ctx.createGain();
    this.drone.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.3;
    this.drone.connect(lp).connect(this.verb);
    lp.connect(this.dry);
    [[98, -4], [98, 5], [146.83, -3], [146.83, 4], [196, 2]].forEach(([f, det], i) => {
      const o = ctx.createOscillator();
      o.type = i === 4 ? 'triangle' : 'sawtooth';
      o.frequency.value = f; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = i === 4 ? 0.05 : 0.035;
      // vibrato lento
      const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6 + i * 0.13;
      const lg = ctx.createGain(); lg.gain.value = 2.5;
      lfo.connect(lg).connect(o.detune);
      o.connect(g).connect(this.drone);
      o.start(); lfo.start();
    });
  }

  toggle(on = !this.enabled) {
    this.init();
    this.enabled = on;
    const t = this.ctx.currentTime;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.4);
    this.drone.gain.setTargetAtTime(on ? this.droneLevel ?? 0.6 : 0, t, 1.2);
    return on;
  }

  setDrone(level) {
    this.droneLevel = level;
    if (!this.ctx || !this.enabled) return;
    this.drone.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
  }

  pluckBuffer(freq) {
    const key = Math.round(freq * 10);
    if (this.cache.has(key)) return this.cache.get(key);
    const ctx = this.ctx, sr = ctx.sampleRate;
    const dur = 2.6, n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, n, sr);
    const out = buf.getChannelData(0);
    const period = Math.round(sr / freq);
    const line = new Float32Array(period);
    for (let i = 0; i < period; i++) line[i] = (Math.random() * 2 - 1) * (1 - Math.abs(i / period - 0.3));
    let idx = 0, prev = 0;
    const decay = 0.996 - Math.min(freq / 40000, 0.004);
    for (let i = 0; i < n; i++) {
      const cur = line[idx];
      const next = line[(idx + 1) % period];
      const v = decay * 0.5 * (cur + next);
      line[idx] = v * 0.7 + prev * 0.3; // cuerpo de madera: suaviza armónicos
      prev = v;
      out[i] = cur;
      idx = (idx + 1) % period;
    }
    // envolvente y caja de resonancia
    for (let i = 0; i < n; i++) out[i] *= Math.min(1, i / 60) * 0.9;
    this.cache.set(key, buf);
    return buf;
  }

  pluck(note, vel = 1) {
    if (!this.enabled) return;
    const f = typeof note === 'number' ? note : FREQ[note] || 440;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.pluckBuffer(f);
    const g = ctx.createGain(); g.gain.value = 0.55 * vel;
    const body = ctx.createBiquadFilter();
    body.type = 'peaking'; body.frequency.value = 280; body.gain.value = 5; body.Q.value = 1.2;
    const air = ctx.createBiquadFilter();
    air.type = 'peaking'; air.frequency.value = 2900; air.gain.value = 3; air.Q.value = 1.0;
    src.connect(body).connect(air).connect(g).connect(this.dry);
    src.start();
  }

  // Pequeño arpegio para momentos clave (al pasar de capítulo)
  chord(notes = ['G3', 'D4', 'A4', 'E5'], gap = 0.07) {
    if (!this.enabled) return;
    notes.forEach((n, i) => setTimeout(() => this.pluck(n, 0.6), i * gap * 1000));
  }
}

export const NOTES = FREQ;
