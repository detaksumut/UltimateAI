/**
 * MusicScoreEngine.js
 * JIN Lyric Sheet player — procedural Web Audio "mini orchestra".
 *
 * 100% client-side, zero external requests. Instruments are synthesized from
 * PeriodicWave harmonic spectra (rich timbre, one oscillator per voice) and
 * mixed through a master bus: gain → compressor (glue/limiter) with a shared
 * convolution reverb send. Voices are lightly humanized (timing + velocity)
 * so the arrangement breathes instead of sounding like a MIDI metronome.
 *
 * Mirrors the AudioContext lifecycle of MagicChimeEngine / TypingSoundEngine.
 */

import { noteFrequency } from './notAngkaParser.js';

// Automatic drum patterns per genre (beats inside a 4/4 bar).
const DRUM_PATTERNS = {
  ballad:  { kick: [0, 2], snare: [2], hat: [0, 1, 2, 3], openHat: [3.5], level: 0.6, sparkle: false },
  pop:     { kick: [0, 2], snare: [1, 3], hat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], level: 0.8, sparkle: true },
  dangdut: { kick: [0, 1.5, 2.5], snare: [1, 1.75, 3, 3.75], hat: [0.5, 1.5, 2.5, 3.5], level: 0.85, sparkle: false },
  rock:    { kick: [0, 2.5], snare: [1, 3], hat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], level: 0.9, sparkle: true },
  dance:   { kick: [0, 1, 2, 3], snare: [1, 3], hat: [0.5, 1.5, 2.5, 3.5], level: 0.92, sparkle: true },
  none:    null
};

function drumPatternFor(genre) {
  const g = String(genre || 'pop').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(DRUM_PATTERNS, g)) return DRUM_PATTERNS[g];
  if (/dangdut|koplo/.test(g)) return DRUM_PATTERNS.dangdut;
  if (/rock|metal|punk|enerjik|ngebut/.test(g)) return DRUM_PATTERNS.rock;
  if (/dance|edm|party|pesta|disko|dj/.test(g)) return DRUM_PATTERNS.dance;
  if (/ballad|sedih|slow|mellow|syahdu|galau|rindu/.test(g)) return DRUM_PATTERNS.ballad;
  return DRUM_PATTERNS.pop;
}

// Arrangement styles: which backing layers to use per genre.
const ARRANGEMENT = {
  ballad:  { arp: true, pad: true, bassPulse: false, strings: true },
  pop:     { arp: false, pad: true, bassPulse: true, strings: true },
  dangdut: { arp: false, pad: false, bassPulse: true, strings: false },
  rock:    { arp: false, pad: false, bassPulse: true, strings: false },
  dance:   { arp: false, pad: true, bassPulse: true, strings: false },
  none:    { arp: false, pad: false, bassPulse: false, strings: false }
};

function arrangementFor(genre) {
  const g = String(genre || 'pop').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ARRANGEMENT, g)) return ARRANGEMENT[g];
  if (/dangdut|koplo/.test(g)) return ARRANGEMENT.dangdut;
  if (/rock|metal|punk|enerjik|ngebut/.test(g)) return ARRANGEMENT.rock;
  if (/dance|edm|party|pesta|disko|dj/.test(g)) return ARRANGEMENT.dance;
  if (/ballad|sedih|slow|mellow|syahdu|galau|rindu/.test(g)) return ARRANGEMENT.ballad;
  return ARRANGEMENT.pop;
}

// Lead-sheet instrument presets. Each picks the sustained chord voice plus the
// arpeggio/pluck voice and how wide/loud the arrangement sits.
export const INSTRUMENT_PRESETS = {
  piano:   { label: 'Piano',   chord: 'piano',   arp: 'pluck', gain: 1.0,  attack: 0.006, detune: 0 },
  strings: { label: 'Strings', chord: 'strings', arp: 'pluck', gain: 0.9,  attack: 0.28,  detune: 7 },
  guitar:  { label: 'Guitar',  chord: 'pluck',   arp: 'pluck', gain: 1.0,  attack: 0.008, detune: 4 },
  ep:      { label: 'E.Piano', chord: 'ep',      arp: 'pluck', gain: 1.0,  attack: 0.01,  detune: 2 },
  synth:   { label: 'Synth',   chord: 'synth',   arp: 'pluck', gain: 0.95, attack: 0.02,  detune: 9 }
};

function instrumentFor(genre, requested) {
  if (requested && INSTRUMENT_PRESETS[requested]) return requested;
  const g = String(genre || 'pop').toLowerCase();
  if (/dangdut|koplo/.test(g)) return 'ep';
  if (/rock|metal|punk/.test(g)) return 'guitar';
  if (/dance|edm|party|pesta|disko|dj/.test(g)) return 'synth';
  if (/ballad|sedih|slow|mellow|syahdu|galau|rindu/.test(g)) return 'piano';
  return 'piano';
}

// Section dynamics — how full/loud the accompaniment sits in each part of a song.
const SECTION_DYNAMICS = {
  intro: 0.58,
  verse: 0.72,
  bridge: 0.82,
  chorus: 1.0,
  interlude: 0.88,
  outro: 0.6
};

// Timbre jenis suara dipilih per instrumen hanya lewat bentuk gelombang.
const TYPE_FOR = {
  strings: 'sawtooth',
  synth: 'sawtooth',
  organ: 'sawtooth'
};
function typeFor(name) {
  return TYPE_FOR[name] || 'triangle';
}

// Prerendered-PCM instrument recipes. Each note is synthesized once into a
// BufferSource waveform (same output path as the drum noise that provably
// sounds), so the orchestra plays on a path that cannot silently fail.
//   attack  : rise time (s)
//   decay   : exponential decay rate after attack (1/s)
//   vibratoHz / vibratoDepth : slow pitch wobble (strings).
//   detune  : +/-(0..1) chorus width as fraction.
//   parts   : [ [harmonic, amp, phaseRad], ... ]
const INST_SPEC = {
  piano:   { attack: 0.004, decay: 0.9, vibratoHz: 0, vibratoDepth: 0, detune: 0.004,
             parts: [[1, 1, 0], [2, 0.6, 0], [3, 0.4, 0], [4, 0.25, 0], [5, 0.15, 0.2], [6, 0.1, 0.4], [7, 0.06, 0], [8, 0.04, 0]] },
  ep:      { attack: 0.003, decay: 0.55, vibratoHz: 0, vibratoDepth: 0, detune: 0.006,
             parts: [[1, 1, 0], [2, 0.35, 0.6], [3, 0.2, 0.2], [4, 0.3, 1.2], [5, 0.12, 0], [6, 0.08, 0]] },
  strings: { attack: 0.05, decay: 0.35, vibratoHz: 5.2, vibratoDepth: 0.004, detune: 0.007,
             parts: [[1, 1, 0], [2, 0.5, 0.3], [3, 0.42, 0], [4, 0.3, 0.9], [5, 0.2, 0.1]] },
  synth:   { attack: 0.006, decay: 0.5, vibratoHz: 0, vibratoDepth: 0, detune: 0.005,
             parts: [[1, 1, 0], [2, 0.5, 0], [3, 0.35, 0], [4, 0.22, 0], [5, 0.14, 0], [6, 0.1, 0]] },
  organ:   { attack: 0.01, decay: 0.3, vibratoHz: 0, vibratoDepth: 0, detune: 0.003,
             parts: [[1, 1, 0], [2, 0.6, 0], [3, 0.5, 0], [4, 0.3, 0], [5, 0.2, 0]] },
  pluck:   { attack: 0.002, decay: 4.5, vibratoHz: 0, vibratoDepth: 0, detune: 0.003,
             parts: [[1, 1, 0], [2, 0.42, 0], [3, 0.22, 0.4], [4, 0.12, 0]] },
  bass:    { attack: 0.006, decay: 2.2, vibratoHz: 0, vibratoDepth: 0, detune: 0,
             parts: [[1, 1, 0], [2, 0.32, 0], [3, 0.13, 0]] }
};
function instSpec(name) {
  return INST_SPEC[name] || INST_SPEC.piano;
}

const MASTER_VOLUME = 0.98;

class MusicScoreEngine {
  constructor() {
    this.ctx = null;
    this.isEnabled = true;
    this._oscillators = [];
    this._timeouts = [];
    this._activeIndex = -1;
    this.onActiveChange = null;
    this._interval = null;
    this._job = null;

    this.masterGain = null;
    this.compressor = null;
    this.reverbInput = null;
    this.reverbGain = null;
    this._drumSend = null;
    this._sampleCache = new Map();
    this._logNotes = 0;
  }

  _initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this._buildBus();
  }

  _buildBus() {
    if (this.masterGain || !this.ctx) return;
    const ctx = this.ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = MASTER_VOLUME;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 26;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.24;

    this.masterGain.connect(this.compressor);
    this.compressor.connect(ctx.destination);

    // Procedural impulse response → lush ensemble reverb.
    this.reverbInput = ctx.createGain();
    this.reverbInput.gain.value = 1;
    const convolver = ctx.createConvolver();
    convolver.buffer = this._impulseResponse(2.6, 2.4);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.26;
    this.reverbInput.connect(convolver);
    convolver.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    // Reduced reverb send for drums (room, not hall).
    this._drumSend = ctx.createGain();
    this._drumSend.gain.value = 0.16;
    this._drumSend.connect(this.reverbInput);
  }

  _impulseResponse(duration, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buffer = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buffer;
  }

  /** Stacks plain oscillators ({osc, amp}) into one rich timbre. */
  _spawn(name, freq, at, detune = 0) {
    const list = [];
    for (const [mult, amp, type] of partialsFor(name)) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * mult, at);
      if (detune) osc.detune.value = detune;
      list.push({ osc, amp });
    }
    return list;
  }

  _panner(value) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = value;
      return p;
    }
    return this.ctx.createGain();
  }

  _route(node, wet) {
    node.connect(this.masterGain);
    if (wet && this.reverbInput) node.connect(this.reverbInput);
  }

  /**
   * Proved-audible minimal voice: identical structure to the kick drum —
   * one oscillator → one gain → master bus. No extra nodes in between, so any
   * environment that can sound the kick can sound every melody note.
   */
  _playTone(type, freq, at, dur, peak, wet = false) {
    if (!this.ctx) return;
    if (!(freq > 0) || !isFinite(at)) {
      console.warn('[JIN_AUDIO_PLAY_SKIP]', type, freq, at);
      return;
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    const end = at + Math.max(0.09, dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    this._route(gain, wet);
    osc.start(at);
    osc.stop(end);
    this._oscillators.push(osc);
  }

  /** Renders one pitching tone as PCM once, then cached — BufferSource path. */
  _synthBuffer(name, freq, dur) {
    const ctx = this.ctx;
    const spec = instSpec(name);
    const rate = ctx.sampleRate;
    const n = Math.max(2, Math.floor(rate * Math.min(2.3, Math.max(0.25, dur))));
    const buf = ctx.createBuffer(1, n, rate);
    const d = buf.getChannelData(0);
    const baseStep = 2 * Math.PI * freq / rate;
    const attack = spec.attack;
    const tailN = Math.floor(rate * 0.02);
    let ph = 0;
    let ph2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      let env = t < attack ? Math.max(0.0001, t / Math.max(0.0005, attack))
                           : Math.exp(-(t - attack) * spec.decay);
      if (i > n - tailN) env = Math.min(env, Math.max(0, (n - i) / tailN));
      const wob = spec.vibratoHz > 0 ? 1 + spec.vibratoDepth * Math.sin(2 * Math.PI * spec.vibratoHz * t) : 1;
      ph += baseStep * wob;
      let s = 0;
      for (const [h, a, p] of spec.parts) s += a * Math.sin(ph * h + p);
      if (spec.detune) {
        ph2 += baseStep * (1 - spec.detune);
        let s2 = 0;
        for (const [h, a, p] of spec.parts) s2 += a * Math.sin(ph2 * h + p);
        s = (s + s2 * 0.55) * 0.65;
      }
      d[i] = s * env * 0.45;
    }
    return buf;
  }

  /** Buffered-instrument note — proves-identical output path to the drum noise. */
  _playSample(name, freq, at, dur, vel, wet = false) {
    if (!this.ctx || !(freq > 0) || !isFinite(at)) return;
    const key = name + '@' + (Math.round(freq / 2) * 2);
    let buf = this._sampleCache.get(key);
    if (!buf) {
      buf = this._synthBuffer(name, freq, dur);
      this._sampleCache.set(key, buf);
      if (this._sampleCache.size > 160) {
        const first = this._sampleCache.keys().next().value;
        this._sampleCache.delete(first);
      }
    }
    if ((this._logNotes = (this._logNotes || 0) + 1) <= 12) {
      console.log('[JIN_AUDIO_SAMPLE]', name, freq.toFixed(1) + 'Hz', '@' + at.toFixed(3), 'dur', buf.duration.toFixed(2), 'vel', vel.toFixed(2));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = Math.max(0.0002, Math.min(1.2, vel));
    src.connect(g);
    this._route(g, wet);
    src.start(at);
    src.stop(at + buf.duration + 0.02);
    this._oscillators.push(src);
  }

  stop() {
    this._stopTicker();
    if (this._mix && this._mix.src) {
      try { this._mix.src.stop(); } catch (_) {}
    }
    this._mix = null;
    this._timeouts.forEach(t => clearTimeout(t));
    this._timeouts = [];
    this._oscillators.forEach(o => {
      try { o.stop(); } catch (_) {}
    });
    this._oscillators = [];
    if (this._activeIndex !== -1) {
      this._activeIndex = -1;
      if (this.onActiveChange) this.onActiveChange(-1);
    }
  }

  _schedule(index, atMs) {
    const t = setTimeout(() => {
      this._activeIndex = index;
      if (this.onActiveChange) this.onActiveChange(index);
    }, Math.max(0, atMs));
    this._timeouts.push(t);
  }

  _noiseBuffer() {
    if (!this._noise) {
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noise = buffer;
    }
    return this._noise;
  }

  // ── Voices ──────────────────────────────────────────────────────────────

  _env(gain, at, peak, attack, decay, dur) {
    const p = Math.max(0.0001, peak);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(p, at + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, p * 0.32), at + attack + Math.max(0.02, decay));
    gain.gain.setValueAtTime(Math.max(0.0002, p * 0.32), at + Math.max(attack + decay, dur * 0.7));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack + decay + 0.02, dur + 0.12));
  }

  // Percussive "key pressed then released" envelope: quick attack, natural decay,
  // with a short release tail so notes ring like a real piano rather than a pad.
  _envPerc(gain, at, peak, attack, dur, ring = 1.7) {
    const p = Math.max(0.0001, peak);
    const tail = Math.max(dur * ring, attack + 0.3);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(p, at + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, p * 0.45), at + attack + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tail);
  }

  /**
   * Voice-leading helper: nudge a chord into the register closest to the
   * previous voicing (inversions + octave shifts) so the accompaniment flows
   * instead of leaping around.
   */
  _leadVoicing(midis, prev) {
    const notes = [...midis].sort((a, b) => a - b);
    if (!prev || !prev.length) return notes;
    const candidates = [notes];
    for (let k = 1; k < notes.length; k++) {
      candidates.push(notes.map((n, i) => (i < k ? n + 12 : n)).sort((a, b) => a - b));
    }
    candidates.push(notes.map(n => n - 12).sort((a, b) => a - b));
    let best = notes;
    let bestCost = Infinity;
    for (const c of candidates) {
      if (Math.min(...c) < 45 || Math.max(...c) > 88) continue;
      const cost = c.reduce((s, n) => s + Math.min(...prev.map(p => Math.abs(p - n))), 0);
      if (cost < bestCost) { bestCost = cost; best = c; }
    }
    return best;
  }

  /** Sustained chord/lead voice — rendered PCM, same path as drum noise. */
  _playVoice(wave, freq, at, dur, vel, opts = {}) {
    if (!this.ctx || freq <= 0) return;
    const preset = INSTRUMENT_PRESETS[wave] || null;
    const waveName = preset ? preset.chord : wave;
    const wet = opts.wet !== false;
    const peak = (opts.level || 0.18) * vel;
    const hold = opts.mode === 'pluck'
      ? Math.max(0.45, dur * (opts.ring || 1.5))
      : Math.min(2.0, dur + 0.4);
    this._playSample(waveName, freq, at, hold, peak, wet);
  }

  /** Plucked voice (guitar / arpeggio). */
  _playPluck(freq, at, dur, vel, wet = true, ring = 1) {
    if (!this.ctx || freq <= 0) return;
    this._playSample('pluck', freq, at, Math.max(0.3, dur * ring), 0.13 * vel, wet);
  }

  _playBass(freq, at, dur, vel = 1) {
    if (!this.ctx || freq <= 0) return;
    this._playSample('bass', freq, at, Math.max(0.4, dur), 0.3 * vel, false);
  }

  _playKick(at, vel = 1) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, at);
    osc.frequency.exponentialRampToValueAtTime(44, at + 0.12);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.9 * vel, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    osc.connect(gain);
    this._route(gain, false);
    osc.start(at);
    osc.stop(at + 0.34);
    this._oscillators.push(osc);
  }

  _playSnare(at, vel = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.42 * vel, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    if (this._drumSend) gain.connect(this._drumSend);

    const osc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(196, at);
    bodyGain.gain.setValueAtTime(0.0001, at);
    bodyGain.gain.exponentialRampToValueAtTime(0.16 * vel, at + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    osc.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    osc.start(at);
    osc.stop(at + 0.14);
    this._oscillators.push(src, osc);
  }

  _playHat(at, vel = 1, open = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = open ? 6500 : 7800;
    const gain = this.ctx.createGain();
    const tail = open ? 0.28 : 0.05;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime((open ? 0.12 : 0.13) * vel, at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tail);
    src.connect(hp);
    hp.connect(gain);
    this._route(gain, false);
    src.start(at);
    src.stop(at + tail + 0.02);
    this._oscillators.push(src);
  }

  _playCrash(at, vel = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.22 * vel, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain);
    if (this._drumSend) gain.connect(this._drumSend);
    src.start(at);
    src.stop(at + 1.15);
    this._oscillators.push(src);
  }

  _arpSequence(midis) {
    const base = midis.slice(0, 4);
    const up = base.concat(base.map(m => m + 12));
    return base.length >= 3 ? up.slice(0, 6) : up;
  }

  // Schedules only the drum hits that fall inside [startBeat, endBeat), scaled by
  // the current section's intensity → verse sits back, chorus drives.
  _scheduleDrumsSegment(startBeat, endBeat, startAt, bpm, genre, intensity, humanize) {
    const pattern = drumPatternFor(genre);
    if (!pattern) return;
    const beatDur = 60 / Math.max(20, bpm);
    const level = (pattern.level || 1) * intensity;
    const jitter = () => (humanize ? (Math.random() - 0.5) * 0.01 : 0);
    const inRange = b => b >= startBeat - 1e-6 && b < endBeat - 1e-6;
    const atBeat = b => startAt + (b - startBeat) * beatDur;

    const firstBar = Math.floor(startBeat / 4);
    const lastBar = Math.floor((endBeat - 1e-6) / 4);

    for (let bar = firstBar; bar <= lastBar; bar++) {
      const barStart = bar * 4;
      (pattern.kick || []).forEach(o => {
        const b = barStart + o;
        if (inRange(b)) this._playKick(atBeat(b) + jitter(), level);
      });
      (pattern.snare || []).forEach(o => {
        const b = barStart + o;
        if (inRange(b)) this._playSnare(atBeat(b) + jitter(), level * (0.9 + Math.random() * 0.2));
      });
      (pattern.hat || []).forEach(o => {
        const b = barStart + o;
        if (inRange(b)) this._playHat(atBeat(b) + jitter(), level * (0.72 + Math.random() * 0.3), false);
      });
      (pattern.openHat || []).forEach(o => {
        const b = barStart + o;
        if (inRange(b)) this._playHat(atBeat(b) + jitter(), level * 0.7, true);
      });

      // Snare fill on the last beat of every 4th bar → pushes into the next phrase.
      if (pattern.sparkle !== false && bar % 4 === 3) {
        [3.5, 3.75].forEach(o => {
          const b = barStart + o;
          if (inRange(b)) this._playSnare(atBeat(b), level * (o === 3.5 ? 0.5 : 0.72));
        });
      }
    }
  }

  /**
   * Play a chord/melody sequence.
   * @param {Array} notes  [{ midis:[...] | midi, rest, dur }]
   * @param {number} bpm
   * @param {Function|null} onActiveChange  callback(index)  (-1 = finished)
   * @param {Object} options  { drums, genre, arrangement, bass, instrument,
   *                            reverb, humanize, volume }
   */
  play(notes = [], bpm = 96, onActiveChange = null, options = {}) {
    this.stop();
    this._initContext();
    if (!this.ctx || notes.length === 0) return;

    this.onActiveChange = onActiveChange;

    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const render = this._renderSong(notes, bpm, options);
    if (!render) return;
    const renderMs = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    console.log('[JIN_AUDIO] lagu dirender ' + render.duration.toFixed(1) + 's dalam ' + Math.round(renderMs) + 'ms (' + notes.length + ' akor)');

    const src = this.ctx.createBufferSource();
    src.buffer = render.buffer;
    src.connect(this.ctx.destination);
    const startTime = this.ctx.currentTime + 0.06;
    src.start(startTime);

    this._mix = { src, startTime, duration: render.duration, noteStarts: render.noteStarts, bpm };
    this._interval = setInterval(() => this._tickPlayhead(), 90);
    this._tickPlayhead();
  }

  // Playhead: maps wall-clock audio time back to the chord index for the card.
  _tickPlayhead() {
    const m = this._mix;
    if (!m) return;
    try {
      const now = this.ctx.currentTime;
      const el = now - m.startTime;
      if (el < 0) return;
      if (el >= m.duration) {
        this._stopTicker();
        this._mix = null;
        this._activeIndex = -1;
        if (this.onActiveChange) this.onActiveChange(-1);
        return;
      }
      const beat = el / (60 / m.bpm);
      let idx = -1;
      for (let k = 0; k < m.noteStarts.length; k++) {
        if (beat < m.noteStarts[k]) break;
        idx = k;
      }
      if (idx !== this._activeIndex) {
        this._activeIndex = idx;
        if (this.onActiveChange) this.onActiveChange(idx);
      }
    } catch (e) {
      console.warn('[JIN_AUDIO_PLAYHEAD_ERR]', e && e.message);
    }
  }

  /**
   * Renders the ENTIRE song into a single mono PCM buffer with pure JS math —
   * orchestra + drums mixed in perfect time, then played back as one
   * BufferSource (the exact same output path as the drum noise that already
   * sounds in every environment). No live scheduling, no node graph, no
   * oscillator quirks: what you hear is the rendered mix, start to finish.
   */
  _renderSong(notes, bpm, options = {}) {
    const rate = 24000; // ample for an instrumental mix, light on memory/time
    const beatDur = 60 / Math.max(20, bpm);
    const noteStarts = [];
    let totalBeats = 0;
    for (const n of notes) {
      noteStarts.push(totalBeats);
      totalBeats += (n.dur || 1);
    }
    if (totalBeats <= 0) return null;
    const totalSec = totalBeats * beatDur;
    const len = Math.round(totalSec * rate) + Math.round(rate * 0.6);
    const mix = new Float32Array(len);

    this._makeNoise(Math.round(rate * 2));
    const presetName = instrumentFor(options.genre, options.instrument);
    const style = arrangementFor(options.genre);
    const useDrums = options.drums !== false;
    const pattern = drumPatternFor(options.genre);
    const echoTap = Math.round(rate * 0.045);
    const echo = options.reverb !== false ? 0.16 : 0;

    const add = (startBeat, durSec, name, freq, amp) => {
      if (freq <= 0 || amp <= 0.0001) return;
      this._writeNote(mix, rate, startBeat * beatDur, durSec, name, freq, amp);
    };
    const writeDrums = (fromBeat, toBeat, sectionIntensity) => this._writeDrums(mix, rate, fromBeat, toBeat, pattern, useDrums, beatDur, sectionIntensity);

    let prevVoicing = null;
    let prevSection = null;
    let beatCursor = 0;

    for (let k = 0; k < notes.length; k++) {
      const note = notes[k];
      const beats = note.dur || 1;
      const section = note.section || 'verse';
      const intensity = SECTION_DYNAMICS[section] || 0.8;
      const full = section === 'chorus';
      const vel = 0.82 + intensity * 0.18;

      if (full && section !== prevSection && useDrums && pattern) {
        this._writeNoise(mix, rate, beatCursor * beatDur, 0.6, 0.5 * intensity, true);
      }

      if (!note.rest) {
        const isChord = Array.isArray(note.midis) && note.midis.length > 0;
        const rawMidis = isChord ? note.midis : (note.midi > 0 ? [note.midi] : []);
        if (isChord && rawMidis.length) {
          const voicing = this._leadVoicing(rawMidis, prevVoicing);
          const root = rawMidis[0];
          const rootFreq = noteFrequency(root - 12);

          if (options.bass !== false) {
            add(beatCursor, Math.min(1.5, beats * beatDur * 0.92), 'bass', rootFreq, 0.72 * vel * intensity);
            if (style.bassPulse && beats > 1.4) {
              add(beatCursor + beats * 0.5, Math.min(0.8, beats * beatDur * 0.38), 'bass', rootFreq, 0.55 * vel * intensity);
            }
          }

          const guitarLike = presetName === 'guitar';
          const useBroken = guitarLike
            ? false
            : (!full && section !== 'interlude' && (style.arp || presetName === 'piano' || presetName === 'ep' || presetName === 'guitar' || presetName === 'strings'));

          if (guitarLike) {
            voicing.forEach((midi, i) => {
              add(beatCursor + i * 0.016, beats * beatDur, 'pluck', noteFrequency(midi), 0.8 * vel * (0.88 - i * 0.05) * intensity);
            });
          } else if (useBroken) {
            const seq = this._arpSequence(voicing);
            const step = beats * beatDur / seq.length;
            seq.forEach((midi, i) => {
              add(beatCursor + i * step, step, 'pluck', noteFrequency(midi), 1.0 * vel * intensity);
            });
            const seqUp = this._arpSequence(voicing.map(m => m + 12));
            const stepUp = beats * beatDur / seqUp.length;
            seqUp.forEach((midi, i) => {
              if (i % 2 === 0) add(beatCursor + i * stepUp, stepUp, 'pluck', noteFrequency(midi), 0.5 * vel * intensity);
            });
            if (style.pad) {
              voicing.forEach(midi => add(beatCursor, beats * beatDur, 'strings', noteFrequency(midi), 0.26 * vel * intensity));
            }
          } else {
            voicing.forEach((midi, i) => {
              add(beatCursor + i * 0.012, beats * beatDur, presetName, noteFrequency(midi), (full ? 1.25 : 1.05) * vel * intensity);
            });
            if (full) {
              const seq = this._arpSequence(voicing.map(m => m + 12));
              const step = beats * beatDur / seq.length;
              seq.forEach((midi, i) => add(beatCursor + i * step, step, 'pluck', noteFrequency(midi), 0.85 * vel * intensity));
            }
            if (style.strings && presetName !== 'strings') {
              voicing.forEach(midi => add(beatCursor, beats * beatDur, 'strings', noteFrequency(midi), 0.38 * vel * intensity));
            }
          }
          prevVoicing = voicing;
        } else {
          rawMidis.forEach(midi => add(beatCursor, beats * beatDur, presetName, noteFrequency(midi), 1.0 * vel * intensity));
        }
      }

      if (useDrums && section !== 'intro' && section !== 'outro') {
        writeDrums(beatCursor, beatCursor + beats, intensity);
      }
      beatCursor += beats;
      prevSection = section;
    }

    // Master volume, one-tap echo reverb, short fade-in, soft-clip,
// plus a high-frequency "crisp" lift so melodic attacks cut through
// like drum triggers instead of sinking into low-mid mud.
    const master = MASTER_VOLUME * (options.volume != null ? options.volume : 1);
    const fadeN = Math.round(rate * 0.012);
    const out = new Float32Array(len);
    let lp = 0;
    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < len; i++) {
      let x = mix[i] * master;
      if (echo > 0 && i >= echoTap) x += out[i - echoTap] * echo;
      lp += (x - lp) * 0.012; // one-pole lowpass → hp = x - lp
      let crisp = x * 0.88 + (x - lp) * 0.7;
      if (i < fadeN) crisp = crisp * (i / fadeN);
      const s = Math.tanh(crisp * 1.85) * 0.97;
      out[i] = s;
      if (s > peak) peak = s;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / len);
    if ((this._logRender = (this._logRender || 0) + 1) <= 3) {
      console.log('[JIN_AUDIO] mix peak=' + peak.toFixed(3) + ' rms=' + rms.toFixed(3));
    }

    const buffer = this.ctx.createBuffer(1, len, rate);
    buffer.getChannelData(0).set(out);
    return { buffer, duration: totalSec + 0.35, noteStarts };
  }

  /** Adds one synthesized note into the mix buffer at its absolute beat time. */
  _writeNote(mix, rate, tStart, durSec, name, freq, amp) {
    const spec = instSpec(name);
    const s0 = Math.max(0, Math.round(tStart * rate));
    const cap = name === 'pluck' ? 0.45 : name === 'bass' ? 0.9 : 1.3;
    const n = Math.min(mix.length - s0, Math.round(Math.min(durSec, cap) * rate));
    if (n <= 0) return;
    const attack = Math.max(2, Math.round(spec.attack * rate));
    const decay = spec.decay;
    const baseStep = 2 * Math.PI * freq / rate;
    const vibHz = spec.vibratoHz;
    const vibD = spec.vibratoDepth;
    const detune = spec.detune || 0;
    const parts = spec.parts;
    const tailN = Math.round(rate * 0.015);
    let ph = 0;
    let ph2 = 0;
    for (let i = 0; i < n; i++) {
      const dt = i / rate;
      let env = i < attack ? i / attack : Math.exp(-(dt - spec.attack) * decay);
      if (i > n - tailN) env = Math.min(env, Math.max(0, (n - i) / tailN));
      const wob = vibHz > 0 ? 1 + vibD * Math.sin(2 * Math.PI * vibHz * dt) : 1;
      ph += baseStep * wob;
      let s = 0;
      for (let p = 0; p < parts.length; p++) {
        s += parts[p][1] * Math.sin(ph * parts[p][0] + parts[p][2]);
      }
      if (detune) {
        ph2 += baseStep * (1 - detune);
        let s2 = 0;
        for (let p = 0; p < parts.length; p++) {
          s2 += parts[p][1] * Math.sin(ph2 * parts[p][0] + parts[p][2]);
        }
        s = (s + s2 * 0.55) * 0.65;
      }
      mix[s0 + i] += s * env * amp * 0.42;
    }
  }

  /** Adds one white-noise hit (hat/snare/crash) into the mix. */
  _writeNoise(mix, rate, tStart, durSec, amp, hi) {
    const noise = this._noise || this._makeNoise(Math.round(rate * 2));
    const s0 = Math.max(0, Math.round(tStart * rate));
    const n = Math.min(mix.length - s0, Math.round(durSec * rate));
    if (n <= 0) return;
    const d = Math.exp(-(hi ? 58 : 20) / rate);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      prev = noise[i % noise.length] - prev * 0.6;
      const t = i / rate;
      const env = hi ? Math.exp(-t * 42) : Math.exp(-t * 16);
      mix[s0 + i] += (hi ? prev : noise[i % noise.length]) * env * amp * 0.5;
    }
  }

  /** Adds one kick drum (pitch-sliding sine) into the mix. */
  _writeKick(mix, rate, tStart, amp) {
    const s0 = Math.max(0, Math.round(tStart * rate));
    const n = Math.min(mix.length - s0, Math.round(0.16 * rate));
    if (n <= 0) return;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const f = 150 - (150 - 42) * Math.min(1, t / 0.14);
      ph += 2 * Math.PI * f / rate;
      mix[s0 + i] += Math.sin(ph) * Math.exp(-t * 17) * amp * 0.9;
    }
  }

  /** Writes every drum hit in [fromBeat, toBeat) into the mix at absolute beats. */
  _writeDrums(mix, rate, fromBeat, toBeat, pattern, useDrums, beatDur, intensity) {
    if (!useDrums || !pattern) return;
    const level = (pattern.level || 1) * (intensity || 0.8) * 0.62;
    const atSec = b => b * beatDur;          // absolute time → sample offset
    const inRange = b => b >= fromBeat - 1e-6 && b < toBeat - 1e-6;
    const firstBar = Math.floor(fromBeat / 4);
    const lastBar = Math.floor((toBeat - 1e-6) / 4);

    for (let bar = firstBar; bar <= lastBar; bar++) {
      const barStart = bar * 4;
      (pattern.kick || []).forEach(o => { const b = barStart + o; if (inRange(b)) this._writeKick(mix, rate, atSec(b), level); });
      (pattern.snare || []).forEach(o => {
        const b = barStart + o;
        if (inRange(b)) this._writeNoise(mix, rate, atSec(b), 0.22, level * 0.8, false);
      });
      (pattern.hat || []).forEach(o => {
        const b = barStart + o;
        if (inRange(b)) this._writeNoise(mix, rate, atSec(b), 0.08, level * 0.55, true);
      });
      (pattern.openHat || []).forEach(o => {
        const b = barStart + o;
        if (inRange(b)) this._writeNoise(mix, rate, atSec(b), 0.24, level * 0.5, true);
      });
      if (pattern.sparkle !== false && bar % 4 === 3) {
        [3.5, 3.75].forEach(o => {
          const b = barStart + o;
          if (inRange(b)) this._writeNoise(mix, rate, atSec(b), 0.2, level * (o === 3.5 ? 0.5 : 0.7), false);
        });
      }
    }
  }

  _makeNoise(len) {
    const arr = new Float32Array(len);
    for (let i = 0; i < len; i++) arr[i] = Math.random() * 2 - 1;
    this._noise = arr;
    return arr;
  }
_stopTicker() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  toggle(enable) {
    this.isEnabled = enable !== undefined ? enable : !this.isEnabled;
    if (!this.isEnabled) this.stop();
  }
}

// Voice doubling: strings/pads use a detuned pair for ensemble width.
function detectVoices(waveName) {
  return (waveName === 'strings' || waveName === 'synth') ? 2 : 1;
}
function detectSpread(waveName) {
  return (waveName === 'strings' || waveName === 'synth') ? 0.45 : 0;
}

export const musicScoreEngineInstance = new MusicScoreEngine();
export default musicScoreEngineInstance;
