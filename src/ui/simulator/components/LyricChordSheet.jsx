/**
 * LyricChordSheet.jsx
 * JIN Lyric Sheet — the simple song view: chords printed directly ABOVE the
 * lyric syllables (lead-sheet style), with Web Audio playback of the chord
 * progression. Replaces the numeric not-angka staff player.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Play, Square, Music, Clock, Drum, Waves } from 'lucide-react';
import { musicScoreEngineInstance, INSTRUMENT_PRESETS } from '../../../services/audio/MusicScoreEngine.js';

const DEFAULT_BPM = 96;

function normalizeSection(label) {
  const s = String(label || '').toLowerCase();
  if (/reff|refrain|chorus/.test(s)) return 'chorus';
  if (/intro|awal/.test(s)) return 'intro';
  if (/bridge|jembatan/.test(s)) return 'bridge';
  if (/interlude|solo|instrument|intermezzo/.test(s)) return 'interlude';
  if (/outro|ending|coda|koda|penutup/.test(s)) return 'outro';
  if (/verse|bait|syair/.test(s)) return 'verse';
  return 'verse';
}

export default function LyricChordSheet({ sheet }) {
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(-1);
  const [bpm, setBpm] = useState(() => sheet?.bpm || DEFAULT_BPM);
  const [drums, setDrums] = useState(true);
  const [instrument, setInstrument] = useState('auto');
  const [reverb, setReverb] = useState(true);

  const pairs = sheet?.pairs || [];
  const chords = sheet?.chords || [];
  const genre = sheet?.genre || 'pop';

  useEffect(() => {
    setBpm(sheet?.bpm || DEFAULT_BPM);
  }, [sheet?.bpm]);

  const playNotes = useMemo(() => {
    const out = [];
    let section = 'verse';
    for (const p of pairs) {
      if (p.type === 'section') {
        section = normalizeSection(p.label);
        continue;
      }
      for (const c of (p.chords || [])) {
        out.push({ rest: false, midis: c.midis, dur: 2, section });
      }
    }
    if (!out.length) {
      return chords.map(c => ({ rest: false, midis: c.midis, dur: 2, section: 'verse' }));
    }
    return out;
  }, [pairs, chords]);

  const pairOffsets = useMemo(() => {
    const offsets = [];
    let running = 0;
    for (const p of pairs) {
      offsets.push(running);
      if (p.type !== 'section') running += (p.chords || []).length;
    }
    return offsets;
  }, [pairs]);

  useEffect(() => () => musicScoreEngineInstance.stop(), []);

  const stopPlayback = () => {
    musicScoreEngineInstance.stop();
    setPlaying(false);
    setActive(-1);
  };

  const handleToggle = () => {
    if (playing) {
      stopPlayback();
      return;
    }
    if (!playNotes.length) return;
    musicScoreEngineInstance.play(
      playNotes,
      bpm,
      idx => {
        if (idx === -1) {
          setActive(-1);
          setPlaying(false);
        } else {
          setActive(idx);
          setPlaying(true);
        }
      },
      { drums, genre, instrument: instrument === 'auto' ? undefined : instrument, reverb }
    );
  };

  const handleBpm = (delta) => {
    if (playing) stopPlayback();
    setBpm(b => Math.min(220, Math.max(40, b + delta)));
  };

  const handleDrums = () => {
    if (playing) stopPlayback();
    setDrums(d => !d);
  };

  return (
    <div className="mt-3 w-full max-w-[560px] rounded-lg overflow-hidden border border-cyan-500/40 bg-[#02050e]/90 shadow-[0_0_25px_rgba(0,229,255,0.12)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/25 bg-cyan-950/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <Music size={13} className="text-cyan-300 flex-shrink-0" />
          <span className="text-[10px] font-mono font-bold text-cyan-200 tracking-wider truncate">
            {String(sheet?.title || 'Lirik & Chord').toUpperCase()}
          </span>
          <span className="text-[9px] font-mono text-slate-500 hidden sm:inline flex-shrink-0">
            JIN LYRIC SHEET
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
            <Clock size={10} className="text-cyan-400" />
            <button
              type="button"
              onClick={() => handleBpm(-5)}
              className="px-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900"
            >
              −
            </button>
            <span className="w-11 text-center text-cyan-200">{bpm} BPM</span>
            <button
              type="button"
              onClick={() => handleBpm(5)}
              className="px-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleDrums}
            title={drums ? 'Matikan drum otomatis' : `Nyalakan drum otomatis (${genre})`}
            className={`px-2 py-1 rounded text-[9px] font-mono font-bold flex items-center gap-1 border transition-all ${
              drums
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 hover:bg-amber-500/30'
                : 'bg-slate-800/60 border-slate-600/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Drum size={11} />
            <span>{drums ? genre.toUpperCase() : 'DRUM OFF'}</span>
          </button>
          <button
            type="button"
            onClick={handleToggle}
            title={playing ? 'Hentikan pemutaran' : 'Putar progresi chord + drum (Web Audio)'}
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all flex-shrink-0 ${
              playing
                ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/40 shadow-[0_0_15px_rgba(0,229,255,0.2)]'
            }`}
          >
            {playing ? <Square size={11} className="fill-red-400" /> : <Play size={11} className="fill-cyan-300" />}
            <span>{playing ? 'STOP' : 'PLAY'}</span>
          </button>
        </div>
      </div>

      <div className="p-3 overflow-x-auto">
        {pairs.map((pair, pi) => {
          let cursor = 0;
          const base = pairOffsets[pi];

          if (pair.type === 'section') {
            return (
              <div key={pi} className="mt-3 mb-1.5 first:mt-0 flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold tracking-widest text-amber-300/90">
                  {String(pair.label || '').toUpperCase()}
                </span>
                <span className="flex-1 h-px bg-amber-400/20" />
              </div>
            );
          }

          return (
            <div key={pi} className="mb-3 last:mb-0">
              <div className="font-mono text-[12px] leading-5 text-cyan-300 whitespace-pre">
                {(pair.chords || []).map((c, ci) => {
                  const gap = c.col - cursor;
                  cursor = c.col + c.name.length;
                  const flatIndex = base + ci;
                  const isActive = flatIndex === active;
                  return (
                    <React.Fragment key={ci}>
                      {gap > 0 ? ' '.repeat(gap) : null}
                      <span
                        className={
                          isActive
                            ? 'text-cyan-100 font-bold bg-cyan-400/25 rounded px-0.5 shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                            : 'hover:text-cyan-100'
                        }
                      >
                        {c.name}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="font-mono text-[12px] leading-5 text-slate-200 whitespace-pre">{pair.lyric}</div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-cyan-500/20 flex items-center justify-between gap-2 text-[9px] font-mono text-slate-500">
        <span className="flex-shrink-0">{pairs.filter(p => p.type !== 'section').length} baris · {chords.length} akor</span>
        <div className="flex items-center gap-2 min-w-0">
          <label className="flex items-center gap-1 flex-shrink-0">
            <Music size={10} className="text-cyan-400" />
            <select
              value={instrument}
              onChange={e => { if (playing) stopPlayback(); setInstrument(e.target.value); }}
              className="bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 rounded px-1 py-0.5 text-[9px] font-mono outline-none"
            >
              <option value="auto">AUTO</option>
              {Object.entries(INSTRUMENT_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>{p.label.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => { if (playing) stopPlayback(); setReverb(r => !r); }}
            title="Reverb/ruang akustik"
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all flex-shrink-0 ${
              reverb
                ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                : 'bg-slate-800/60 border-slate-600/50 text-slate-500'
            }`}
          >
            <Waves size={10} />
            REVERB
          </button>
        </div>
      </div>
    </div>
  );
}