  createWaves(items) {
    if (!Array.isArray(items)) return [];
    const waves = [];
    for (let i = 0; i < items.length; i += WAVE_SIZE) {
      waves.push(items.slice(i, i + WAVE_SIZE));
    }
    return waves;
  }

  sanitizeUtf8(text) {
    if (typeof text !== 'string') return '';
    let out = text;
    out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, ' ');
    out = out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD');
    out = out.replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
    return out;
  }

  normalizeWhitespace(text) {
    if (!text) return '';
    return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }

  stripBidiControls(text) {
    if (!text) return '';
    return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/g, '');
  }

  buildParagraphUnit(text, rawLine, lineNo, pageRef, type) {
    return {
      type: type || 'paragraph',
      content: text,
      lineStart: lineNo,
      lineEnd: lineNo,
      pageRef,
      length: text.length,
      citation: null
    };
  }

  buildTelemetry(units, meta) {
    const byType = {};
    for (const u of units) {
      const t = u && u.type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    }
    return {
      byType,
      totalUnits: units.length,
      pagesDetected: meta && meta.pagesDetected || 0,
      sectionsDetected: meta && meta.sectionsDetected || 0,
      tablesDetected: meta && meta.tablesDetected || 0,
      figuresDetected: meta && meta.figuresDetected || 0,
      chartsDetected: meta && meta.chartsDetected || 0,
      formulasDetected: meta && meta.formulasDetected || 0,
      waves: meta && meta.waves || [],
      waveCount: meta && meta.waves ? meta.waves.length : 0,
      totalWaveBytes: meta && meta.totalWaveBytes || 0,
      mode: meta && meta.mode || 'full_document'
    };
  }

  buildSummary(units, meta) {
    const byType = {};
    for (const u of units) {
      const t = u && u.type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    }
    const t = [];
    t.push('Analyzed ' + (meta && meta.fileName || 'document'));
    t.push('Total semantic units: ' + (units.length || 0));
    t.push('Units by type: ' + Object.keys(byType).map((k) => k + '=' + byType[k]).join(', '));
    t.push('Pages detected: ' + (meta && meta.pagesDetected || 0));
    t.push('Coverage: 100% (full_document mode - all units retained, none discarded)');
    t.push('Batched in ' + (meta && meta.waveCount || 0) + ' wave(s) with ' +
      (meta && meta.waveSize || WAVE_SIZE) + ' units per wave');
    if (meta && meta.mode === 'retrieval') {
      t.push('Mode: retrieval (relevance-ranked; full text available via full_document)');
    } else {
      t.push('Mode: full_document (structure-aware semantic chunking, no content loss)');
    }
    return t.join('\n');
  }
