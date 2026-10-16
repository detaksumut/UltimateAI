/**
 * notAngkaParser.js
 * Pure parsers + detection for JIN "not angka" sheet-music notation.
 * No dependencies on React or AudioContext, so both the Web Audio engine and
 * the canvas renderer can share this single source of truth.
 *
 * Notation grammar (Indonesian standard):
 *   digit 1-7                -> degree (do re mi fa sol la si)
 *   leading '.' (x1..x2)     -> one/two octaves lower
 *   trailing apostrophes '   -> one/two octaves higher
 *   trailing '#' or 'b'      -> sharp / flat
 *   '0' or '-'               -> rest (one beat)
 *   '|'                      -> bar line (ignored, visual only)
 *   optional header "1=C"    -> key reference (or '1=D', ...) in title/text
 *
 * Each token equals ONE beat by default. A message is recognized as a score
 * when it contains enough numeric-note-dense lines (>=3 digit notes).
 */

const DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const NAMED_MIDI = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
const KEY_TOKEN_RE = /1\s*=\s*([A-Ga-g][#b]?)/;

const TOKEN_RE = /(\.{1,2}[1-7][#b]?'{0,2}|[1-7][#b]?'{1,2}|[1-7][#b]?|[0-])/g;

export function noteFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function keyMidiForDegree1(key = 'C') {
  const letter = key.replace('#', '').replace('b', '').toUpperCase();
  const base = NAMED_MIDI[letter] ?? 60;
  const sharp = key.includes('#') ? 1 : key.includes('b') ? -1 : 0;
  return base + sharp;
}

/**
 * Parse raw notation text into { notes, keyMidiFor1, octaveShift }.
 * notes: [{ degree|null, accidental|null, octaveShift, rest, midi, dur, token }]
 */
export function parseNotAngka(text = '') {
  const keyMatch = String(text).match(KEY_TOKEN_RE);
  const keyMidiFor1 = keyMatch ? keyMidiForDegree1(keyMatch[1]) : 60;

  const notes = [];
  const cleaned = String(text)
    .replace(KEY_TOKEN_RE, ' ')
    .replace(/```[^\n]*\n?/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s{2,}/g, ' ');

  let m;
  const re = new RegExp(TOKEN_RE.source, 'g');
  while ((m = re.exec(cleaned)) !== null) {
    const token = m[0];
    if (token === '0' || token === '-') {
      notes.push({ degree: null, accidental: null, octaveShift: 0, rest: true, dur: 1, token });
      continue;
    }

    const leadingDots = (token.match(/^\./g) || []).length;
    let body = token.replace(/^\.+/, '');
    const octaveShift = leadingDots * -1 + (body.match(/'/g) || []).length;
    body = body.replace(/'/g, '');
    const accidental = body.includes('#') ? '#' : body.includes('b') ? 'b' : null;
    body = body.replace(/[#b]/g, '');
    const degree = parseInt(body[0], 10);

    if (degree >= 1 && degree <= 7) {
      const midi = keyMidiFor1 + DEGREE_SEMITONES[degree - 1] + 12 * octaveShift
        + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
      notes.push({
        degree,
        accidental,
        octaveShift,
        rest: false,
        midi,
        freq: noteFrequency(midi),
        dur: 1,
        token
      });
    }
  }

  return { notes, keyMidiFor1, key: keyMatch ? keyMatch[1].toUpperCase() : 'C' };
}

// ── Chord progression support ────────────────────────────────────────────────
// Weak/local LLMs often emit a chord chart ("C | G | Am | F") under a
// "Not Angka" header instead of numeric notes. We detect it and play an
// arpeggiated accompaniment so the song is still audible.
const CHORD_TOKEN_RE = /^([A-G][#b]?)(maj7|maj9|m7b5|m7|maj|min7|min|dim7|dim|aug|sus2|sus4|add9|m|7|6|9)?$/;
const CHORD_QUALITIES = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  add9: [0, 4, 7, 14],
  '9': [0, 4, 7, 10, 14],
  m7b5: [0, 3, 6, 10],
  maj9: [0, 4, 7, 11, 14],
  min7: [0, 3, 7, 10],
  dim7: [0, 3, 6, 9]
};

function chordToMidis(token) {
  const m = String(token).trim().match(CHORD_TOKEN_RE);
  if (!m) return null;
  const rootLetter = m[1][0].toUpperCase();
  const accidental = m[1].includes('#') ? 1 : m[1].includes('b') ? -1 : 0;
  const quality = (m[2] || '').toLowerCase();
  const intervals = CHORD_QUALITIES[quality] || CHORD_QUALITIES[m[2] || ''] || [0, 4, 7];
  const root = (NAMED_MIDI[rootLetter] ?? 60) + accidental;
  return { name: `${m[1]}${m[2] || ''}`, root, midis: intervals.map(i => root + i) };
}

/**
 * Parse chord-chart lines into a chord progression.
 * A line qualifies when >= 2 chord tokens make up >= 60% of its word tokens,
 * so ordinary lyric lines (which may start with letters A-G) are ignored.
 */
export function parseChordProgression(text = '') {
  const chords = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/\*\*/g, '').replace(/`/g, ' ').trim();
    if (!line) continue;
    const segments = line.split('|').map(s => s.trim()).filter(Boolean);
    const chordTokens = [];
    let wordCount = 0;
    for (const seg of segments.length > 1 ? segments : [line]) {
      const segWords = seg.split(/\s+/).filter(Boolean);
      wordCount += segWords.length;
      for (const w of segWords) {
        const clean = w.replace(/[),.;:!?]+$/g, '');
        if (chordToMidis(clean)) chordTokens.push(clean);
      }
    }
    if (chordTokens.length >= 2 && wordCount > 0 && chordTokens.length / wordCount >= 0.6) {
      for (const tok of chordTokens) {
        const chord = chordToMidis(tok);
        if (chord) chords.push(chord);
      }
    }
  }
  return chords;
}

// ── Lyric + chord lead sheet ─────────────────────────────────────────────────
// Simpler, primary format: chords printed directly ABOVE the lyric syllables.
//   C              G
//   Rambate, rambate berjalan
//   Am             F
//   Saat matahari terbit
// Also supports inline brackets: [C]Rambate [G]rambate berjalan
const INLINE_CHORD_RE = /\[([A-G][#b]?(?:maj7|maj9|m7b5|m7|maj|min7|min|dim7|dim|aug|sus2|sus4|add9|m|7|6|9)?)\]/g;
const CHORD_SCAN_RE = /([A-G][#b]?)(maj7|maj9|m7b5|m7|maj|min7|min|dim7|dim|aug|sus2|sus4|add9|m|7|6|9)?/g;
const LYRIC_LABEL_RE = /^(lirik|lyric|verse|chorus|bridge|intro|outro|reff|progresi|progression|chord|bpm|tempo|instrumental|interlude)\b/i;

function chordTokensInLine(line) {
  const normalized = String(line).replace(/\|/g, ' ');
  const out = [];
  const re = new RegExp(CHORD_SCAN_RE.source, 'g');
  let m;
  while ((m = re.exec(normalized)) !== null) {
    const tok = m[0];
    const before = m.index > 0 ? normalized[m.index - 1] : ' ';
    const after = normalized[m.index + tok.length] || ' ';
    if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) continue;
    if (!chordToMidis(tok)) continue;
    out.push({ name: tok, col: m.index, end: m.index + tok.length });
  }
  return out;
}

function isChordLine(line) {
  const tokens = chordTokensInLine(line);
  if (tokens.length === 0) return false;
  const words = String(line).replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return tokens.length / words.length >= 0.5;
}

function parseInlineChordLine(line) {
  const re = new RegExp(INLINE_CHORD_RE.source, 'g');
  const chords = [];
  let lyric = '';
  let last = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (!chordToMidis(m[1])) continue;
    lyric += line.slice(last, m.index);
    chords.push({ name: m[1], col: lyric.length, end: lyric.length + m[1].length });
    last = m.index + m[0].length;
  }
  if (chords.length === 0) return null;
  lyric += line.slice(last);
  return { chords, lyric: lyric.trim() };
}

function isLyricLabel(line) {
  const clean = String(line).replace(/[*_#`]/g, '').trim();
  return !clean || LYRIC_LABEL_RE.test(clean) || /:$/.test(clean);
}

function sheetTitle(text) {
  const bracket = text.match(/\[[^\]]*(?:not\s*angka|chord|lirik|lagu|song)[^\]]*\]/i);
  if (bracket) {
    return bracket[0]
      .replace(/[\[\]]/g, '')
      .replace(/^\s*(?:not\s*angka|chord\s*&?\s*lirik|lirik\s*&?\s*chord|chord|lirik)\s*[:\-]?\s*/i, '')
      .trim() || 'Lirik & Chord';
  }
  const plain = text.match(/(?:not\s*angka|judul|lagu|song|chord\s*&?\s*lirik)\s*[:\-]\s*([^\n|*]+)/i);
  if (plain) return plain[1].replace(/[*_#`]/g, '').trim();
  return 'Lirik & Chord';
}

/**
 * Infer a sensible BPM from the user's request when the assistant omitted a
 * tempo line. Explicit "NN BPM" / "tempo NN" always wins.
 */
export function inferTempoFromRequest(text = '') {
  const s = String(text).toLowerCase();
  const explicit = s.match(/(\d{2,3})\s*bpm/) || s.match(/tempo\s*[:\-]?\s*(\d{2,3})/);
  if (explicit) {
    const n = parseInt(explicit[1], 10);
    if (n >= 40 && n <= 220) return n;
  }
  if (/\b(ballad|sedih|sedu|slow|mellow|syahdu|galau|rindu|menyayat)\b/.test(s)) return 70;
  if (/\b(dangdut|koplo|punk|metal|hardcore|enerjik|ngebut|menghentak)\b/.test(s)) return 140;
  if (/\b(dance|edm|party|pesta|upbeat|gembira|ceria|riang|semangat)\b/.test(s)) return 122;
  if (/\b(pop)\b/.test(s)) return 108;
  return null;
}

/**
 * Infer a drum genre from the user's request for automatic rhythm selection.
 */
export function inferGenreFromRequest(text = '') {
  const s = String(text).toLowerCase();
  if (/dangdut|koplo/.test(s)) return 'dangdut';
  if (/rock|metal|punk|hardcore|enerjik|ngebut/.test(s)) return 'rock';
  if (/dance|edm|party|pesta|disko|dj\b/.test(s)) return 'dance';
  if (/ballad|sedih|slow|mellow|syahdu|galau|rindu/.test(s)) return 'ballad';
  return 'pop';
}

function sheetBpm(text) {
  const clamp = n => (Number.isFinite(n) && n >= 40 && n <= 220 ? Math.round(n) : null);
  const labeled =
    text.match(/tempo\s*[:\-]?\s*(\d{2,3})/i) ||
    text.match(/(\d{2,3})\s*bpm/i) ||
    text.match(/bpm\s*[:\-]?\s*(\d{2,3})/i);
  if (labeled) {
    const n = clamp(parseInt(labeled[1], 10));
    if (n) return n;
  }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    const bare = line.match(/^\**[^0-9]*(\d{2,3})[^0-9]*\**$/);
    if (bare && !/[A-Za-z]/.test(line.replace(/\*\*/g, ''))) {
      const n = clamp(parseInt(bare[1], 10));
      if (n) return n;
    }
  }
  return null;
}

/**
 * Extract lyrics with chords printed above them (lead-sheet style).
 * Returns { kind:'lead', title, bpm, pairs:[{type:'line'|'section', ...}], chords }
 * or null when there is no usable sheet.
 */
const SECTION_NAMES_RE = /^\**\s*(intro|outro|verse|reff|refrain|chorus|pre[\s-]?chorus|bridge|interlude|solo|instrumental|koda|coda|ending|penutup|bait)\b/i;

export function extractLyricChordSheet(content = '') {
  if (!content || typeof content !== 'string') return null;
  const text = String(content);
  const lines = text.split(/\r?\n/).map(l => l.replace(/\*\*/g, '').replace(/`/g, '').trimEnd());

  const pairs = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/\[[A-G][#b]?/.test(line)) {
      const inline = parseInlineChordLine(line);
      if (inline && inline.chords.length > 0 && inline.lyric) {
        pairs.push({ type: 'line', ...inline });
        continue;
      }
    }

    const secMatch = line.match(SECTION_NAMES_RE);
    if (secMatch && !isChordLine(line)) {
      const label = line.replace(/[*_#`]/g, '').replace(/[:\-]+\s*$/, '').trim();
      const wordCount = label.split(/\s+/).filter(Boolean).length;
      if (wordCount <= 3 && label.length <= 20) {
        pairs.push({ type: 'section', label });
        continue;
      }
    }

    if (isChordLine(line)) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const lyric = j < lines.length ? lines[j].trim() : '';
      if (lyric && !isChordLine(lyric) && !/^\[/.test(lyric) && !isLyricLabel(lyric)) {
        pairs.push({ type: 'line', chords: chordTokensInLine(line), lyric });
        i = j;
      }
    }
  }

  const lineItems = pairs.filter(p => p.type === 'line');
  if (lineItems.length < 2) return null;

  const chords = [];
  for (const pair of lineItems) {
    for (const c of pair.chords) {
      const parsed = chordToMidis(c.name);
      if (parsed) chords.push(parsed);
    }
  }
  if (chords.length < 2) return null;

  return { kind: 'lead', title: sheetTitle(text), bpm: sheetBpm(text), pairs, chords };
}

function isNoteDenseLine(line) {
  if (!line || typeof line !== 'string') return false;
  const tokens = line.match(TOKEN_RE) || [];
  if (tokens.length < 6) return false;
  const digitNotes = tokens.filter(t => /[1-7]/.test(t)).length;
  return digitNotes >= 3;
}

/**
 * Extract a score (title + notation) from a full assistant message.
 * Priority: fenced code block -> [Not Angka ...] bracketed section -> note-dense lines.
 * Returns null when the message does not contain a playable score.
 */
export function extractNotAngkaScore(content = '') {
  if (!content || typeof content !== 'string') return null;
  const text = String(content);

  const asChordScore = (title, srcText) => {
    const chords = parseChordProgression(srcText);
    if (chords.length < 2) return null;
    return { kind: 'chord', title: title || 'Chord Progression', musicText: srcText.trim(), chords };
  };

  // 1. Fenced code block with a music-ish language tag
  const fenceRe = /```([^\n]*)\n([\s\S]*?)```/g;
  let fm;
  while ((fm = fenceRe.exec(text)) !== null) {
    const lang = (fm[1] || '').toLowerCase().trim();
    if (/(music|musik|not|angka|score|melody|chord)/.test(lang)) {
      const parsed = parseNotAngka(fm[2]);
      if (parsed.notes.length >= 4) {
        return {
          kind: 'melody',
          title: (fm[1] || '').trim() || 'Not Angka',
          musicText: fm[2].trim(),
          ...parsed
        };
      }
      const chordScore = asChordScore((fm[1] || '').trim(), fm[2]);
      if (chordScore) return chordScore;
    }
  }

  const SECTION_LABEL_RE = /(?:^|\n)\s*(?:lirik|lyrics?|progresi|progression|verse|chorus|bridge|intro|outro|tempo|bpm)\b/i;

  // 2. Bracketed header: [Not Angka: Title] ... until a label / next bracket
  const bracketStart = text.search(/\[[Nn]ot\s*[Aa]ngka[^\]]*\]/);
  if (bracketStart !== -1) {
    const from = text.slice(bracketStart);
    const headerEnd = from.indexOf(']') + 1;
    const headerText = from.slice(1, headerEnd - 1).trim();
    let rest = from.slice(headerEnd);
    const nextBracket = rest.search(/\[(?:[Nn]ot\s*[Aa]ngka|Chord|Lirik|End)/);
    if (nextBracket !== -1) rest = rest.slice(0, nextBracket);
    const labelMatch = rest.match(SECTION_LABEL_RE);
    if (labelMatch && labelMatch.index > 0) rest = rest.slice(0, labelMatch.index);
    const bodyText = rest.trim();
    const parsed = parseNotAngka(bodyText);
    if (parsed.notes.length >= 4) {
      return { kind: 'melody', title: headerText || 'Not Angka', musicText: bodyText, ...parsed };
    }
    const chordScore = asChordScore(headerText, bodyText);
    if (chordScore) return chordScore;
  }

  // 3. Non-bracketed header: "Not Angka: Title" / "Not Angka - Title" / bold variants
  const plainHeader = text.match(/^[ \t>*_#-]*not\s*angka(?:\s*[:\-]\s*|\s+)([^\n|*]*)/im);
  if (plainHeader) {
    const headerText = (plainHeader[1] || '').replace(/[*_#`]/g, '').replace(/[:\-]+$/, '').trim();
    let rest = text.slice(plainHeader.index + plainHeader[0].length);
    const labelMatch = rest.match(SECTION_LABEL_RE);
    if (labelMatch && labelMatch.index > 0) rest = rest.slice(0, labelMatch.index);
    const bodyText = rest.trim();
    const parsed = parseNotAngka(bodyText);
    if (parsed.notes.length >= 4) {
      return { kind: 'melody', title: headerText || 'Not Angka', musicText: bodyText, ...parsed };
    }
  }

  // 4. Line-level melody detection across the message
  const musicLines = [];
  let cur = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (isNoteDenseLine(line)) {
      cur = cur === null ? line : `${cur}\n${line}`;
    } else if (cur !== null) {
      musicLines.push(cur);
      cur = null;
    }
  }
  if (cur !== null) musicLines.push(cur);

  if (musicLines.length > 0) {
    const combined = musicLines.join('\n');
    const parsed = parseNotAngka(combined);
    if (parsed.notes.length >= 4) {
      return { kind: 'melody', title: 'Not Angka', musicText: combined, ...parsed };
    }
  }

  // 5. Chord-chart fallback anywhere in the message
  const titleHint = (text.match(/not\s*angka(?:\s*[-:]\s*)([^\n|*]+)/i) || [])[1] || 'Chord Progression';
  return asChordScore(titleHint.replace(/[*_#`]/g, '').trim(), text);
}

export function defaultBpmFor(notes = []) {
  return notes.length > 48 ? 120 : notes.length > 20 ? 108 : 92;
}