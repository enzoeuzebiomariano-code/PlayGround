// Tiny original chiptune synth: every melody and sound effect is generated live.
const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function midiOf(name) {
  if (!name || name === '-') return null;
  const match = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!match) return null;
  return NOTE_INDEX[match[1]] + (Number(match[2]) + 1) * 12;
}
const freqOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const NOTE = (name) => freqOf(midiOf(name));

const CHORDS = {
  C: [0, 4, 7], D: [2, 6, 9], E: [4, 8, 11], F: [5, 9, 12], G: [7, 11, 14],
  A: [9, 13, 16], B: [11, 15, 18], Am: [9, 12, 16], Bm: [11, 14, 18],
  Dm: [2, 5, 9], Em: [4, 7, 11], Bb: [10, 14, 17], 'F#m': [6, 9, 13],
};
const BASS_ROOT = { C: 36, D: 38, E: 40, F: 41, G: 43, A: 45, B: 47, Am: 45, Bm: 47, Dm: 38, Em: 40, Bb: 46, 'F#m': 42 };

// Four bars, eight eighth-notes per bar. Hand-written hooks around generated accompaniment.
const SONGS = {
  plains: {
    bpm: 132, chords: ['C', 'G', 'Am', 'F'], style: 'bounce', lead: 'square', arp: 'triangle',
    melody: [
      'E5', 'G5', 'A5', 'G5', 'E5', 'G5', 'A5', 'C6',
      'B5', 'G5', 'E5', 'G5', 'D5', 'E5', 'G5', 'B5',
      'A5', 'C6', 'B5', 'A5', 'G5', 'E5', 'D5', 'E5',
      'C5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'G4',
    ],
  },
  title: {
    bpm: 122, chords: ['C', 'Am', 'F', 'G'], style: 'bounce', lead: 'triangle', arp: 'square',
    melody: [
      'G5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5', '-',
      'C6', 'B5', 'A5', 'G5', 'E5', 'G5', 'A5', '-',
      'A5', 'G5', 'E5', 'D5', 'C5', 'D5', 'E5', 'G5',
      'D5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'C5',
    ],
  },
  cave: {
    bpm: 98, chords: ['Am', 'F', 'C', 'E'], style: 'spooky', lead: 'triangle', arp: 'sine',
    melody: [
      'A4', '-', 'C5', 'E5', 'C5', '-', 'A4', 'E4',
      'B4', '-', 'D5', 'F5', 'D5', '-', 'B4', 'G4',
      'C5', 'E5', 'G5', 'E5', 'C5', 'A4', 'E5', 'D5',
      'E5', 'D5', 'C5', 'B4', 'A4', '-', 'E4', '-',
    ],
  },
  forest: {
    bpm: 108, chords: ['Dm', 'Bb', 'F', 'A'], style: 'soft', lead: 'sine', arp: 'triangle',
    melody: [
      'D5', 'F5', 'A5', 'F5', 'D5', 'A4', 'D5', 'F5',
      'C5', 'E5', 'G5', 'E5', 'C5', 'G4', 'C5', 'E5',
      'Bb4', 'D5', 'F5', 'D5', 'Bb4', 'F4', 'Bb4', 'D5',
      'A4', 'C5', 'E5', 'C5', 'A4', 'E4', 'A4', '-',
    ],
  },
  mountain: {
    bpm: 144, chords: ['D', 'G', 'A', 'Bm'], style: 'epic', lead: 'square', arp: 'triangle',
    melody: [
      'D5', 'F#5', 'A5', 'F#5', 'D5', 'A4', 'D5', 'F#5',
      'E5', 'G5', 'B5', 'G5', 'E5', 'B4', 'E5', 'G5',
      'F#5', 'A5', 'D6', 'A5', 'F#5', 'D5', 'A5', 'F#5',
      'E5', 'D5', 'B4', 'A4', 'F#4', 'A4', 'D5', '-',
    ],
  },
  castle: {
    bpm: 118, chords: ['Em', 'D', 'C', 'B'], style: 'march', lead: 'square', arp: 'triangle',
    melody: [
      'E5', 'G5', 'B5', 'G5', 'E5', 'B4', 'E5', 'G5',
      'D5', 'F#5', 'A5', 'F#5', 'D5', 'A4', 'D5', 'F#5',
      'C5', 'E5', 'G5', 'E5', 'C5', 'G4', 'C5', 'E5',
      'B4', 'D#5', 'F#5', 'D#5', 'B4', 'F#4', 'B4', '-',
    ],
  },
  boss: {
    bpm: 158, chords: ['Am', 'G', 'F', 'E'], style: 'boss', lead: 'square', arp: 'sawtooth',
    melody: [
      'A5', '-', 'C6', '-', 'E6', 'D6', 'C6', 'A5',
      'G5', '-', 'B5', '-', 'D6', 'C6', 'B5', 'G5',
      'F5', '-', 'A5', '-', 'C6', 'B5', 'A5', 'F5',
      'E5', '-', 'G#5', '-', 'B5', 'E6', 'D6', 'B5',
    ],
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.delay = null;
    this.muted = false;
    this.song = null;
    this.songName = '';
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.playing = false;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.72;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 18;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.22;
      this.master.connect(limiter).connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.31;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.master);

      this.delay = this.ctx.createDelay(1);
      this.delay.delayTime.value = 0.27;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.2;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.22;
      this.delay.connect(feedback).connect(this.delay);
      this.delay.connect(wet).connect(this.master);
      return this.ctx;
    } catch {
      this.ctx = null;
      return null;
    }
  }

  async unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.72, now + 0.12);
  }

  tone(freq, when, dur, { wave = 'square', vol = 0.1, attack = 0.006, release = 0.1, slide = null, send = 0, detune = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx || !freq) return;
    const t = Math.max(when, ctx.currentTime);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    osc.connect(gain).connect(this.musicGain);
    if (send) {
      const sendGain = ctx.createGain();
      sendGain.gain.value = send;
      gain.connect(sendGain).connect(this.delay);
    }
    osc.start(t);
    osc.stop(t + dur + release + 0.03);
  }

  sfxTone(freq, dur, opts = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.wave || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(28, opts.slide), t + dur);
    const vol = opts.vol ?? 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.12, when = 0, type = 'highpass', freq = 1200 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const length = Math.ceil(ctx.sampleRate * Math.max(0.03, dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(t);
  }

  sfx(name) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    switch (name) {
      case 'jump':
        this.sfxTone(330, 0.13, { slide: 680, vol: 0.14, wave: 'square' });
        break;
      case 'land':
        this.noise(0.07, { vol: 0.06, type: 'lowpass', freq: 420 });
        break;
      case 'coin':
        this.sfxTone(988, 0.07, { vol: 0.11, wave: 'square' });
        this.sfxTone(1319, 0.14, { vol: 0.1, wave: 'square', delay: 0.06 });
        break;
      case 'stomp':
        this.sfxTone(220, 0.12, { slide: 80, vol: 0.2, wave: 'triangle' });
        this.noise(0.08, { vol: 0.1, type: 'lowpass', freq: 800 });
        break;
      case 'hurt':
        this.sfxTone(360, 0.32, { slide: 80, vol: 0.18, wave: 'sawtooth' });
        this.noise(0.18, { vol: 0.07, type: 'lowpass', freq: 600 });
        break;
      case 'powerup':
        ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => this.sfxTone(NOTE(n), 0.16, { vol: 0.13, wave: 'square', delay: i * 0.07 }));
        break;
      case 'star':
        [1047, 1319, 1568, 2093].forEach((f, i) => this.sfxTone(f, 0.13, { vol: 0.08, wave: 'triangle', delay: i * 0.05 }));
        break;
      case 'checkpoint':
        ['G5', 'C6', 'E6'].forEach((n, i) => this.sfxTone(NOTE(n), 0.2, { vol: 0.11, wave: 'triangle', delay: i * 0.09 }));
        break;
      case 'pipe':
        this.sfxTone(520, 0.4, { slide: 90, vol: 0.15, wave: 'square' });
        this.noise(0.35, { vol: 0.05, type: 'bandpass', freq: 700 });
        break;
      case 'bounce':
        this.sfxTone(160, 0.3, { slide: 720, vol: 0.18, wave: 'sine' });
        break;
      case 'bossHit':
        this.sfxTone(140, 0.35, { slide: 45, vol: 0.24, wave: 'sawtooth' });
        this.noise(0.25, { vol: 0.16, type: 'lowpass', freq: 500 });
        break;
      case 'explode':
        this.noise(0.6, { vol: 0.18, type: 'lowpass', freq: 900 });
        this.sfxTone(90, 0.6, { slide: 35, vol: 0.2, wave: 'triangle' });
        break;
      case 'gate':
        ['A4', 'C5', 'E5', 'A5', 'C6'].forEach((n, i) => this.sfxTone(NOTE(n), 0.22, { vol: 0.08, wave: 'sine', delay: i * 0.07 }));
        break;
      case 'bossDoor':
        this.sfxTone(110, 0.5, { slide: 70, vol: 0.15, wave: 'sawtooth' });
        break;
      case 'clear':
        ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => this.sfxTone(NOTE(n), 0.24, { vol: 0.12, wave: 'square', delay: i * 0.1 }));
        break;
      case 'victory':
        [['C5', 0], ['E5', 0.12], ['G5', 0.24], ['C6', 0.36], ['G5', 0.6], ['C6', 0.72], ['E6', 0.9], ['G6', 1.1]]
          .forEach(([n, d]) => this.sfxTone(NOTE(n), 0.3, { vol: 0.12, wave: 'triangle', delay: d }));
        break;
      case 'gameover':
        ['G5', 'E5', 'C5', 'G4'].forEach((n, i) => this.sfxTone(NOTE(n), 0.35, { vol: 0.12, wave: 'triangle', delay: i * 0.16 }));
        break;
      case 'select':
        this.sfxTone(660, 0.05, { vol: 0.06, wave: 'square' });
        break;
      default:
        break;
    }
  }

  startMusic(name) {
    const ctx = this.ensure();
    if (!ctx) return;
    const song = SONGS[name] || SONGS.plains;
    this.songName = name;
    this.song = song;
    this.step = 0;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.08;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 38);
  }

  pauseMusic() {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
  }

  resumeMusic() {
    if (!this.song || this.playing) return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.1;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 38);
  }

  schedule() {
    if (!this.playing || !this.song || !this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    const stepDuration = 60 / this.song.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.18) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDuration;
      this.step = (this.step + 1) % 32;
    }
  }

  playStep(step, when) {
    const song = this.song;
    if (!song) return;
    const bar = Math.floor(step / 8) % 4;
    const beat = step % 8;
    const chordName = song.chords[bar];
    const chord = CHORDS[chordName] || CHORDS.C;
    const root = BASS_ROOT[chordName] ?? 36;
    const leadName = song.melody[step];
    const lead = leadName && leadName !== '-' ? NOTE(leadName) : null;
    const style = song.style;

    if (lead) {
      this.tone(lead, when, 0.16, {
        wave: song.lead, vol: style === 'soft' ? 0.055 : 0.075,
        send: style === 'spooky' || style === 'soft' ? 0.35 : 0.13,
      });
      if (style === 'boss') this.tone(lead / 2, when, 0.12, { wave: 'sawtooth', vol: 0.025 });
    }

    if (beat === 0 || beat === 4) {
      this.tone(freqOf(root), when, 0.19, { wave: 'triangle', vol: 0.11 });
    } else if (beat === 2 || beat === 6) {
      this.tone(freqOf(root + 7), when, 0.14, { wave: 'triangle', vol: 0.07 });
    }

    const arpIndex = [0, 1, 2, 1][beat % 4];
    const arpNote = chord[arpIndex] + 24 + (beat >= 4 ? 12 : 0);
    this.tone(freqOf(arpNote), when, style === 'spooky' ? 0.15 : 0.08, {
      wave: song.arp, vol: style === 'soft' ? 0.026 : 0.035,
      send: 0.08,
    });

    const kick = style === 'boss' ? beat % 2 === 0 : beat === 0 || beat === 4;
    const snare = style === 'boss' ? beat === 3 || beat === 7 : beat === 2 || beat === 6;
    if (kick) this.tone(120, when, 0.12, { wave: 'sine', slide: 48, vol: 0.13 });
    if (snare) this.noise(0.09, { vol: 0.045, when: when - this.ctx.currentTime, type: 'highpass', freq: 1800 });
    if (style !== 'soft' || beat % 2 === 0) {
      this.noise(0.025, { vol: style === 'boss' ? 0.03 : 0.018, when: when - this.ctx.currentTime, type: 'highpass', freq: 6000 });
    }
  }
}

export { SONGS };
