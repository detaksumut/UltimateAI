/**
 * JINTickerConversation.jsx
 * Enterprise Futuristic Character-by-Character Ticker Response UI for JIN.
 * Real SSE stream renderer that reveals incoming tokens one character at a time,
 * synchronized with procedural mechanical keystroke sound effects per character.
 * Zero fake delays, zero word-based chunks, pure character-level ticker.
 */

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
  Send, Terminal, AlertTriangle, Trash2, ArrowDown, Volume2, VolumeX,
  Paperclip, FileText, Image as ImageIcon, X, Download, Mic, MicOff,
  ExternalLink, Copy, Check, Sparkles
} from 'lucide-react';
import JSZip from 'jszip';
import { conversationControllerInstance } from '../../../services/conversation/ConversationController.js';
import { typingSoundEngineInstance } from '../../../services/audio/TypingSoundEngine.js';
import { voiceControllerInstance } from '../../../services/voice/VoiceController.js';
import JINMusicPlayerCard from './JINMusicPlayerCard.jsx';

// Helpers to safely read uploaded files as DataURL or Text
const readFileAsDataUrl = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(file);
});

const readFileAsText = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => resolve('');
  reader.readAsText(file);
});

const readDocxAsText = async (file) => {
  try {
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (docXml) {
      return docXml
        .replace(/<w:p\b[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  } catch (err) {
    console.warn('[TickerInput] Failed to extract docx text via JSZip:', err);
  }
  return '';
};

// Helper to safely handle Unicode surrogate pairs (e.g. emojis)
function getCharStep(text, index) {
  if (index >= text.length) return 1;
  const code = text.charCodeAt(index);
  if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
    return 2;
  }
  return 1;
}

/**
 * Streaming-Aware Markdown Parser
 * Parses both completed and OPEN/STREAMING code fences (```lang ... without closing ```)
 * Eliminates Cumulative Layout Shift (CLS) and code block pop-in jumping.
 */
function parseStreamingMarkdown(text) {
  if (!text) return [];
  const blocks = [];
  let remaining = text;

  while (remaining.length > 0) {
    const startIdx = remaining.indexOf('```');
    if (startIdx === -1) {
      blocks.push({ type: 'text', content: remaining });
      break;
    }

    if (startIdx > 0) {
      blocks.push({ type: 'text', content: remaining.slice(0, startIdx) });
    }

    const afterFence = remaining.slice(startIdx + 3);
    const endIdx = afterFence.indexOf('```');

    if (endIdx === -1) {
      // Unclosed / streaming code block
      const firstNl = afterFence.indexOf('\n');
      let lang = '';
      let code = '';
      if (firstNl !== -1) {
        lang = afterFence.slice(0, firstNl).trim();
        code = afterFence.slice(firstNl + 1);
      } else {
        lang = afterFence.trim();
        code = '';
      }
      blocks.push({ type: 'code', lang: lang || 'plaintext', code, isStreaming: true });
      break;
    } else {
      // Closed code block
      const firstNl = afterFence.indexOf('\n');
      let lang = '';
      let code = '';
      if (firstNl !== -1 && firstNl < endIdx) {
        lang = afterFence.slice(0, firstNl).trim();
        code = afterFence.slice(firstNl + 1, endIdx);
      } else {
        code = afterFence.slice(0, endIdx);
      }
      blocks.push({ type: 'code', lang: lang || 'plaintext', code, isStreaming: false });
      remaining = afterFence.slice(endIdx + 3);
    }
  }

  return blocks;
}

/**
 * Sub-Block Extractor for non-code text segments.
 * Completely suppresses any raw HTML tags, unclosed divs, and CSS styling from leaking into the text stream.
 * Converts markdown images into image cards and leaves clean plain text.
 */
function extractSubBlocks(text) {
  if (!text) return [];
  const results = [];

  // Strictly strip any raw HTML tags, stray unclosed divs, comments, and style definitions
  let cleanText = text
    .replace(/<div\b[^>]*>[\s\S]*?<\/div>/gi, '') // complete div blocks
    .replace(/<div\b[\s\S]*$/gi, '') // unclosed div tag at stream end
    .replace(/<[^>]+>/g, '') // any other html tag
    .replace(/<!--[\s\S]*?-->/g, '') // comments
    .replace(/(?:font-family|box-sizing|aspect-ratio|border-radius|background):\s*[^;\n]+;?/gi, '')
    .trim();

  let idx = 0;
  const len = cleanText.length;

  while (idx < len) {
    const remaining = cleanText.slice(idx);
    const imgMatch = /!\[([^\]]*)\]\(([^)]+)\)/.exec(remaining);

    if (!imgMatch) {
      results.push({ type: 'text', content: cleanText.slice(idx) });
      break;
    }

    if (imgMatch.index > 0) {
      results.push({ type: 'text', content: cleanText.slice(idx, idx + imgMatch.index) });
    }

    results.push({ type: 'image', alt: imgMatch[1], src: imgMatch[2] });
    idx += imgMatch.index + imgMatch[0].length;
  }

  return results;
}

function SlideVisualOrchestrator({ src, title = "SLIDE PRESENTATION (16:9 HD)" }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  return (
    <div className="mb-3 rounded-xl overflow-hidden border border-cyan-400/40 shadow-[0_4px_25px_rgba(0,0,0,0.7)] bg-[#030816]">
      {/* Header Bar */}
      <div className="bg-cyan-950/80 px-3.5 py-2 border-b border-cyan-500/30 flex items-center justify-between text-[10px] font-mono select-none">
        <span className="text-cyan-300 font-bold flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isLoaded ? 'bg-cyan-400 shadow-[0_0_8px_#00e5ff]' : 'bg-amber-400 animate-ping'}`} />
          <span>{isLoaded ? title : 'ORCHESTRATING VISUAL ASSET...'}</span>
        </span>
        {isLoaded && (
          <a 
            href={src} 
            download={`jin_master_slide_${Date.now()}.jpg`}
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-500/40 text-cyan-200 font-mono text-[10px] transition-all"
            title="Unduh visual slide ini"
          >
            <Download size={11} className="text-cyan-400" />
            <span>Unduh Slide HD</span>
          </a>
        )}
      </div>

      {/* Synchronized Orchestration Skeleton while image prepares */}
      {!isLoaded && !hasError && (
        <div className="w-full aspect-[16/9] flex flex-col items-center justify-center p-6 bg-cyan-950/20 border border-cyan-500/20 text-cyan-300 font-mono text-xs gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="font-bold tracking-wider text-cyan-200">SINKRONISASI VISUAL MASTER...</span>
            <span className="text-[10px] text-slate-400">Menyempurnakan Palet Warna: Putih Mayor, Navy Blue &amp; Emas</span>
          </div>
        </div>
      )}

      {/* Main Orchestrated Image */}
      <img 
        src={src} 
        alt="Master Slide Visual" 
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full max-h-[480px] object-contain cursor-pointer hover:opacity-95 transition-opacity block ${
          isLoaded ? 'block' : 'hidden'
        }`}
        onClick={() => window.open(src, '_blank')}
        title="Klik untuk membuka slide ukuran penuh di tab baru"
      />
    </div>
  );
}

function CanvasCardRenderer({ htmlContent }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(htmlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenNewTab = () => {
    try {
      const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>JIN Digital Flyer Canvas</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px;background:#030712;display:flex;justify-content:center;align-items:center;min-height:100vh;">${htmlContent}</body></html>`;
      const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {}
  };

  const handleDownload = () => {
    try {
      const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>JIN Digital Flyer Canvas</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px;background:#030712;display:flex;justify-content:center;align-items:center;min-height:100vh;">${htmlContent}</body></html>`;
      const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jin_canvas_flyer_${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-emerald-500/40 shadow-[0_0_25px_rgba(46,204,113,0.18)] bg-[#020906] select-text">
      {/* Canvas Header Bar */}
      <div className="bg-emerald-950/85 px-3.5 py-2 border-b border-emerald-500/30 flex items-center justify-between text-[11px] font-mono select-none">
        <div className="flex items-center gap-2 text-emerald-300 font-bold tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#2ecc71] animate-pulse" />
          <span className="truncate max-w-[220px] sm:max-w-none">JIN CONVERSATION CANVAS // LIVE FLAYER</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-0.5 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[10px] transition-all flex items-center gap-1 cursor-pointer"
            title="Salin Kode HTML"
          >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="text-emerald-400" />}
            <span>{copied ? 'Tersalin' : 'Salin'}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewTab}
            className="px-2 py-0.5 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[10px] transition-all flex items-center gap-1 cursor-pointer"
            title="Buka Penuh di Tab Baru"
          >
            <ExternalLink size={10} className="text-emerald-400" />
            <span className="hidden sm:inline">Buka Penuh</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-2 py-0.5 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[10px] transition-all flex items-center gap-1 cursor-pointer"
            title="Unduh Berkas HTML Flayer"
          >
            <Download size={10} className="text-emerald-400" />
            <span className="hidden sm:inline">Unduh</span>
          </button>
        </div>
      </div>

      {/* Rendered Canvas Body */}
      <div className="p-2 bg-[#030c08]/90 overflow-x-auto custom-scrollbar">
        <div 
          className="jin-canvas-inner-content w-full min-w-[520px] flex justify-center items-center"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
}

function MarkdownImageRenderer({ alt, src }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const resolvedSrc = (src || '')
    .replace(/^[A-Za-z]:[\\\/].*?[\\\/]public[\\\/]/i, '/')
    .replace(/\\/g, '/');

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-cyan-500/40 shadow-[0_0_20px_rgba(0,229,255,0.15)] bg-[#030816] select-none">
      <div className="bg-cyan-950/70 px-3 py-1.5 border-b border-cyan-500/20 flex items-center justify-between text-[10px] font-mono">
        <span className="text-cyan-300 font-bold flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${loaded ? 'bg-cyan-400' : 'bg-amber-400 animate-ping'}`} />
          {alt || 'JIN PRESENTATION SLIDE'}
        </span>
        {loaded && (
          <a 
            href={resolvedSrc} 
            download={`jin_slide_${Date.now()}.jpg`}
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 transition-colors"
          >
            <Download size={10} />
            <span>Unduh Visual</span>
          </a>
        )}
      </div>
      <div className="p-2 bg-transparent flex justify-center items-center min-h-[140px]">
        {loadFailed ? (
          <div className="text-center p-4 text-xs font-mono text-slate-400 flex flex-col items-center gap-2">
            <span className="text-amber-400">Sinkronisasi Aset Visual Sedang Berlangsung...</span>
            <button
              type="button"
              onClick={() => setLoadFailed(false)}
              className="px-3 py-1 bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 rounded text-[10px] hover:bg-cyan-900 cursor-pointer"
            >
              Muat Ulang Gambar
            </button>
          </div>
        ) : (
          <img 
            src={resolvedSrc} 
            alt={alt || 'Visual Slide'} 
            onLoad={() => setLoaded(true)}
            onError={() => setLoadFailed(true)}
            className="w-full max-h-[520px] rounded object-contain border border-cyan-500/20 cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => window.open(resolvedSrc, '_blank')}
            title="Klik untuk membuka ukuran penuh"
          />
        )}
      </div>
    </div>
  );
}

// Renders formatted markdown-like text, code blocks, and ticker tokens
export function TickerResponse({ message, isStreaming, onContentGrowth }) {
  const isUser = message.role === 'user';
  const isError = Boolean(message.error);
  const targetContent = message.content || '';

  const slideImageToDisplay = !isUser && message.imageUrl ? message.imageUrl : null;
  const slideTitleToDisplay = message.slideTitle || "JIN VISUAL ASSET";

  // Historical / user messages display instantly.
  // Active live streaming assistant messages reveal with fluid adaptive interpolation.
  const [revealedCount, setRevealedCount] = useState(() => (isStreaming && !isUser ? 0 : targetContent.length));
  const countRef = useRef(revealedCount);
  countRef.current = revealedCount;

  const targetContentRef = useRef(targetContent);
  targetContentRef.current = targetContent;

  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  const animFrameRef = useRef(null);
  const lastCharTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Dedicated Adaptive Character Pump Loop (60/120 FPS synchronized)
  const pumpLoop = (now) => {
    if (!isMountedRef.current) return;

    const current = countRef.current;
    const fullText = targetContentRef.current;
    const targetLen = fullText.length;
    const currentlyStreaming = isStreamingRef.current;

    if (current < targetLen) {
      const backlog = targetLen - current;
      const elapsed = now - lastCharTimeRef.current;

      // Adaptive Fluid Pacing:
      // Small backlog (<= 6 chars): 1 char per ~16ms (relaxed mechanical cadence)
      // Medium backlog (7 - 25 chars): 2 chars per frame
      // Large backlog (26 - 60 chars): 3-4 chars per frame
      // Massive burst (> 60 chars): dynamic lerp catchup to avoid lag
      let charsToReveal = 1;
      let targetInterval = 16;

      if (backlog > 80) {
        charsToReveal = Math.min(8, Math.ceil(backlog / 10));
        targetInterval = 0;
      } else if (backlog > 40) {
        charsToReveal = Math.min(4, Math.ceil(backlog / 12));
        targetInterval = 8;
      } else if (backlog > 18) {
        charsToReveal = 2;
        targetInterval = 12;
      } else {
        charsToReveal = 1;
        targetInterval = 16;
      }

      if (elapsed >= targetInterval || lastCharTimeRef.current === 0) {
        let advanced = 0;
        let nextIdx = current;
        let soundChar = null;

        while (advanced < charsToReveal && nextIdx < targetLen) {
          const step = getCharStep(fullText, nextIdx);
          if (!soundChar) {
            soundChar = fullText.slice(nextIdx, nextIdx + step);
          }
          nextIdx += step;
          advanced++;
        }

        if (soundChar) {
          typingSoundEngineInstance.play(soundChar);
        }

        const next = Math.min(targetLen, nextIdx);
        countRef.current = next;
        setRevealedCount(next);
        lastCharTimeRef.current = now;

        if (onContentGrowth) {
          onContentGrowth();
        }
      }

      animFrameRef.current = requestAnimationFrame(pumpLoop);
    } else if (currentlyStreaming) {
      // Stream is still open upstream, keep RAF active waiting for next token
      animFrameRef.current = requestAnimationFrame(pumpLoop);
    } else {
      // Drained & finished
      animFrameRef.current = null;
    }
  };

  const pumpLoopRef = useRef(pumpLoop);
  pumpLoopRef.current = pumpLoop;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);

  // Continuous stream watcher
  useEffect(() => {
    if (isUser) {
      setRevealedCount(targetContent.length);
      countRef.current = targetContent.length;
      return;
    }

    if (!animFrameRef.current && (countRef.current < targetContent.length || isStreaming)) {
      animFrameRef.current = requestAnimationFrame((now) => {
        if (pumpLoopRef.current) {
          pumpLoopRef.current(now);
        }
      });
    }
  }, [targetContent, isStreaming, isUser]);

  const displayText = isUser ? targetContent : targetContent.slice(0, revealedCount);
  const isTickerActive = !isUser && (isStreaming || revealedCount < targetContent.length);

  // Render streaming-aware formatted content with zero layout jump
  const renderFormattedContent = (text) => {
    if (!text) return null;
    const blocks = parseStreamingMarkdown(text);

    return blocks.map((block, idx) => {
      if (block.type === 'code') {
        return (
          <div
            key={idx}
            className={`my-2 rounded bg-[#02050e]/90 border transition-colors font-mono text-xs overflow-hidden shadow-md ${
              block.isStreaming
                ? 'border-cyan-400/60 shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                : 'border-cyan-500/30'
            }`}
          >
            <div className="bg-cyan-950/60 px-3 py-1.5 text-[10px] text-cyan-300 border-b border-cyan-500/20 uppercase tracking-wider flex justify-between items-center select-none">
              <span className="font-bold flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${block.isStreaming ? 'bg-cyan-400 animate-ping' : 'bg-cyan-500'}`} />
                {block.lang}
              </span>
              <span className="text-[9px] text-slate-400">
                {block.isStreaming ? 'STREAMING CODE...' : 'JIN CODE ENGINE'}
              </span>
            </div>
            <pre className="p-3 text-cyan-100 overflow-x-auto selection:bg-cyan-500/30 whitespace-pre">
              <code>
                {block.code}
                {block.isStreaming && (
                  <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-cyan-400 align-middle rounded-sm shadow-[0_0_10px_#00e5ff,0_0_20px_rgba(0,229,255,0.7)] animate-pulse" />
                )}
              </code>
            </pre>
          </div>
        );
      }

      // Non-code block: extract HTML canvas cards, markdown images, and plain text
      const subBlocks = extractSubBlocks(block.content);

      return (
        <span key={idx}>
          {subBlocks.map((sub, sIdx) => {
            if (sub.type === 'html_card') {
              return <CanvasCardRenderer key={sIdx} htmlContent={sub.content} />;
            }

            if (sub.type === 'image') {
              return <MarkdownImageRenderer key={sIdx} alt={sub.alt} src={sub.src} />;
            }

            // Plain text block with line breaks
            const lines = sub.content.split('\n');
            return (
              <span key={sIdx}>
                {lines.map((line, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <br />}
                    {line}
                  </React.Fragment>
                ))}
              </span>
            );
          })}
        </span>
      );
    });
  };

  // Determine if the cursor should be rendered at the end of the bubble
  // (Only if the ticker is active and the last block wasn't an active streaming code block)
  const blocks = isTickerActive ? parseStreamingMarkdown(displayText) : [];
  const lastBlock = blocks[blocks.length - 1];
  const showTrailingCursor = isTickerActive && (!lastBlock || lastBlock.type !== 'code' || !lastBlock.isStreaming);

  return (
    <div
      className={`ticker-message-row mb-4 flex flex-col ${
        isUser ? 'items-end' : 'items-start'
      }`}
    >
      <div className="flex items-center gap-2 mb-1 text-[10px] font-mono tracking-wider select-none">
        <span
          className={`px-1.5 py-0.5 rounded transition-all ${
            isUser
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : isError
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,229,255,0.15)]'
          }`}
        >
          {isUser ? '[USER]' : isError ? '[JIN ERROR]' : '[JIN]'}
        </span>
        <span className="text-slate-500 text-[9px]">{message.timestamp || ''}</span>
      </div>

      <div
        className={`ticker-bubble rounded-lg px-4 py-2.5 max-w-[92%] font-mono text-[13px] leading-relaxed break-words shadow-lg transition-all ${
          isUser
            ? 'bg-cyan-950/30 border border-cyan-500/30 text-cyan-50'
            : isError
            ? 'bg-red-950/40 border border-red-500/40 text-red-200'
            : 'bg-[#060e1e]/85 border border-cyan-500/30 text-slate-100 shadow-[0_0_25px_rgba(0,229,255,0.06)]'
        }`}
      >
        {/* User Attached Files (Images & Documents) */}
        {message.files && message.files.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {message.files.map((f, fIdx) => (
              <div
                key={f.id || fIdx}
                className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-cyan-500/30 text-xs font-mono"
              >
                {f.isImage && f.dataUrl ? (
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    className="w-16 h-16 rounded object-cover border border-cyan-400/40 cursor-pointer hover:opacity-85 transition-opacity"
                    onClick={() => window.open(f.dataUrl, '_blank')}
                    title="Klik untuk melihat gambar ukuran penuh"
                  />
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-cyan-950/50 rounded border border-cyan-500/20">
                    <FileText size={16} className="text-emerald-400 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-cyan-200 text-[11px] font-medium truncate max-w-[160px]" title={f.name}>
                        {f.name}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {f.size ? `${Math.round(f.size / 1024)} KB` : 'Dokumen'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* JIN Generated Slide Visual Orchestration */}
        {slideImageToDisplay && (
          <SlideVisualOrchestrator src={slideImageToDisplay} title={slideTitleToDisplay} />
        )}

        {/* JIN Interactive Online Music Player */}
        {message.musicPlayer && (
          <JINMusicPlayerCard
            initialTrackIndex={message.musicPlayer.initialTrackIndex ?? 0}
            autoPlay={message.musicPlayer.autoPlay ?? false}
            customUrl={message.musicPlayer.customUrl || ''}
          />
        )}

        <div className="ticker-content">
          {renderFormattedContent(displayText)}
          {showTrailingCursor && (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 align-middle rounded-sm shadow-[0_0_10px_#00e5ff,0_0_20px_rgba(0,229,255,0.7)] animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

export function TickerHistory({ messages, activeStreamingId }) {
  const scrollRef = useRef(null);
  const bottomAnchorRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const rafScrollRef = useRef(null);

  // High-performance RAF scroll synchronization (prevents forced layout thrashing)
  const scheduleSmoothScroll = () => {
    if (!autoScroll || rafScrollRef.current) return;
    rafScrollRef.current = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      rafScrollRef.current = null;
    });
  };

  useLayoutEffect(() => {
    if (autoScroll) {
      scheduleSmoothScroll();
    }
  }, [messages, activeStreamingId, autoScroll]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafScrollRef.current) {
        cancelAnimationFrame(rafScrollRef.current);
        rafScrollRef.current = null;
      }
    };
  }, []);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="ticker-history-container flex-1 overflow-y-auto px-4 py-4 custom-scrollbar relative"
    >
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-xs tracking-widest gap-2">
          <Terminal size={20} className="text-cyan-500/40 mb-2 animate-pulse" />
          <span>INTELLIGENCE STREAM AWAITING INPUT</span>
          <span className="text-[10px] text-slate-600">Model: Ollama hermes3:8b (Local :20200)</span>
        </div>
      ) : (
        <div className="flex flex-col">
          {messages.map((msg) => (
            <TickerResponse
              key={msg.id}
              message={msg}
              isStreaming={msg.id === activeStreamingId}
              onContentGrowth={scheduleSmoothScroll}
            />
          ))}
          <div ref={bottomAnchorRef} className="h-1 w-full pointer-events-none" />
        </div>
      )}

      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-6 bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 text-[10px] font-mono px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,229,255,0.2)] hover:bg-cyan-900 transition-all flex items-center gap-1.5"
        >
          <ArrowDown size={12} className="text-cyan-400" /> SCROLL TO LATEST
        </button>
      )}
    </div>
  );
}

export function TickerInput({ onSend, status, onClear }) {
  const [text, setText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef(null);
  const isBusy = status === 'sending' || status === 'streaming';

  const handleToggleMic = () => {
    try { typingSoundEngineInstance._getAudioContext(); } catch (_) {}

    if (isListening) {
      voiceControllerInstance.stopListening();
      setIsListening(false);
      return;
    }

    voiceControllerInstance.handleUserBargeIn();
    setIsListening(true);

    voiceControllerInstance.startListening({
      onStart: () => {
        setIsListening(true);
      },
      onTranscript: (transcriptText) => {
        setText(transcriptText);
      },
      onFinalTranscript: (finalText) => {
        setIsListening(false);
        if (finalText && finalText.trim()) {
          const cleanText = finalText.trim();
          console.log(`[TickerInput] 🎙 Auto-sending spoken prompt: "${cleanText}"`);
          setText('');
          try {
            onSend(cleanText, []);
          } catch (err) {
            console.error('[TickerInput] auto-send voice error:', err);
          }
        }
      },
      onError: (err) => {
        console.warn('[TickerInput] Mic error:', err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      }
    });
  };

  const handleFilesSelect = async (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (!rawFiles.length) return;

    setIsReadingFiles(true);
    try {
      const processed = await Promise.all(
        rawFiles.map(async (file) => {
          const isImage = file.type.startsWith('image/');
          const isText =
            file.type.startsWith('text/') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.csv') ||
            file.name.endsWith('.js') ||
            file.name.endsWith('.ts') ||
            file.name.endsWith('.py') ||
            file.name.endsWith('.html') ||
            file.name.endsWith('.css') ||
            file.name.endsWith('.md') ||
            file.name.endsWith('.txt') ||
            file.name.endsWith('.log');
          const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
          const isDocx =
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.name.endsWith('.docx');

          let dataUrl = null;
          let content = '';

          if (isImage && file.size < 10 * 1024 * 1024) {
            dataUrl = await readFileAsDataUrl(file);
          } else if (isPdf && file.size < 15 * 1024 * 1024) {
            dataUrl = await readFileAsDataUrl(file);
          } else if (isText && file.size < 1024 * 1024) {
            content = await readFileAsText(file);
          } else if (isDocx && file.size < 10 * 1024 * 1024) {
            content = await readDocxAsText(file);
          } else if (file.size < 500 * 1024) {
            content = await readFileAsText(file);
          }

          return {
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'document',
            isImage,
            isPdf,
            dataUrl,
            content
          };
        })
      );

      setAttachedFiles((prev) => [...prev, ...processed]);
    } catch (err) {
      console.warn('[TickerInput] File read error:', err);
    } finally {
      setIsReadingFiles(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveFile = (idToRemove) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== idToRemove));
  };

  const handleSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const clean = text.trim();
    if ((!clean && attachedFiles.length === 0) || isBusy || isReadingFiles) return;

    if (isListening) {
      voiceControllerInstance.stopListening();
      setIsListening(false);
    }

    try {
      onSend(clean, attachedFiles);
    } catch (err) {
      console.error('[TickerInput] onSend error:', err);
    }

    setText('');
    setAttachedFiles([]);
  };

  const handleKeyDown = (e) => {
    // Barge-in on keypress
    try { voiceControllerInstance.handleUserBargeIn(); } catch (_) {}

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    let hasImage = false;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        hasImage = true;
        const file = item.getAsFile();
        if (file && file.size < 10 * 1024 * 1024) {
          const dataUrl = await readFileAsDataUrl(file);
          const pastedFile = {
            id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: `clipboard-${Date.now()}.png`,
            size: file.size,
            type: file.type,
            isImage: true,
            isPdf: false,
            dataUrl,
            content: ''
          };
          setAttachedFiles((prev) => [...prev, pastedFile]);
        }
        e.preventDefault();
        break;
      }
    }

    if (!hasImage) {
      // Let default paste behavior handle text
    }
  };

  const hasContentToSend = Boolean(text.trim() || attachedFiles.length > 0);

  return (
    <div className="ticker-input-wrapper border-t border-cyan-500/20 bg-[#030712]/95 flex flex-col">
      {/* Attached Files Preview Chips */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2.5 pb-1 border-b border-cyan-500/10 bg-cyan-950/20">
          {attachedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 text-[11px] font-mono shadow-[0_0_10px_rgba(0,229,255,0.1)] group transition-all"
            >
              {file.isImage ? (
                file.dataUrl ? (
                  <img
                    src={file.dataUrl}
                    alt={file.name}
                    className="w-5 h-5 rounded object-cover border border-cyan-400/50 flex-shrink-0"
                  />
                ) : (
                  <ImageIcon size={14} className="text-cyan-400 flex-shrink-0" />
                )
              ) : (
                <FileText size={14} className="text-emerald-400 flex-shrink-0" />
              )}
              <span className="truncate max-w-[140px]" title={file.name}>
                {file.name}
              </span>
              <span className="text-[9px] text-cyan-400/60 font-mono">
                ({Math.round((file.size || 0) / 1024) || 1} KB)
              </span>
              <button
                type="button"
                onClick={() => handleRemoveFile(file.id)}
                className="ml-1 p-0.5 text-slate-400 hover:text-red-400 rounded transition-colors"
                title="Hapus lampiran"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Action Bar */}
      <form onSubmit={handleSubmit} action="javascript:void(0);" className="ticker-input-bar p-3 flex items-center gap-2">
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            title="Bersihkan Riwayat Obrolan"
            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.docx,.doc,.txt,.csv,.json,.md,.js,.py,.html,.css"
          onChange={handleFilesSelect}
          className="hidden"
        />

        {/* Microphone Button (🎙 Push-to-Talk / Toggle) */}
        <button
          type="button"
          onClick={handleToggleMic}
          disabled={isBusy || isReadingFiles}
          title={isListening ? 'Mikrofon Aktif (Klik untuk berhenti)' : 'Bicara ke JIN (Klik Mikrofon)'}
          className={`p-2 rounded border transition-all flex items-center justify-center ${
            isListening
              ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse scale-105'
              : 'text-cyan-400/80 hover:text-cyan-200 hover:bg-cyan-500/20 border-cyan-500/30 shadow-[0_0_10px_rgba(0,229,255,0.08)]'
          } disabled:opacity-40`}
        >
          {isListening ? <Mic size={16} className="text-emerald-300 animate-pulse" /> : <Mic size={16} />}
        </button>

        {/* Attach File Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy || isReadingFiles}
          title="Lampirkan Dokumen atau Gambar (PDF, DOCX, TXT, CSV, JPG, PNG)"
          className="p-2 text-cyan-400/80 hover:text-cyan-200 hover:bg-cyan-500/20 rounded border border-cyan-500/30 transition-all disabled:opacity-40 flex items-center justify-center shadow-[0_0_10px_rgba(0,229,255,0.08)]"
        >
          <Paperclip size={16} />
        </button>

        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isListening
                ? '🎙 Mendengarkan suara Anda... (Bicara sekarang)'
                : isReadingFiles
                ? 'Sedang membaca file lampiran...'
                : isBusy
                ? 'JIN is streaming response...'
                : attachedFiles.length > 0
                ? 'Tulis instruksi untuk file terlampir... (Enter untuk kirim)'
                : 'Ketik pesan untuk JIN... (Enter untuk kirim)'
            }
            disabled={isBusy || isReadingFiles}
            className={`w-full bg-slate-950/80 border ${isListening ? 'border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-cyan-500/30'} rounded px-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400 placeholder:text-slate-600 disabled:opacity-50`}
          />
        </div>

        <button
          type="submit"
          disabled={!hasContentToSend || isBusy || isReadingFiles}
          className="px-4 py-2.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded text-xs font-mono font-semibold hover:bg-cyan-500/30 disabled:opacity-30 disabled:hover:bg-cyan-500/20 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,229,255,0.1)]"
        >
          <Send size={14} />
          <span>KIRIM</span>
        </button>
      </form>
    </div>
  );
}

export default function JINTickerConversation() {
  const [state, setState] = useState(() => conversationControllerInstance.getSnapshot());
  const [soundEnabled, setSoundEnabled] = useState(() => typingSoundEngineInstance.isEnabled());
  const [speakerEnabled, setSpeakerEnabled] = useState(() => voiceControllerInstance.isSpeakerEnabled());

  useEffect(() => {
    const unsubscribe = conversationControllerInstance.subscribe(setState);
    return () => unsubscribe();
  }, []);

  const handleToggleSound = () => {
    const next = typingSoundEngineInstance.toggle();
    setSoundEnabled(next);
  };

  const handleToggleSpeaker = () => {
    const next = !speakerEnabled;
    voiceControllerInstance.setSpeakerEnabled(next);
    setSpeakerEnabled(next);
  };

  const handleSend = (text, attachedFiles = []) => {
    // User interaction unblocks Web Audio API autoplay policy
    try {
      typingSoundEngineInstance._getAudioContext();
    } catch (_) {}
    try {
      conversationControllerInstance.sendMessage(text, attachedFiles);
    } catch (err) {
      console.error('[JINTickerConversation] handleSend error:', err);
    }
  };

  const handleClear = () => {
    conversationControllerInstance.clearHistory();
  };

  const { messages, status, activeStreamingId, error } = state;

  return (
    <div className="jin-ticker-conversation w-full h-full flex flex-col bg-[#040711]/60">
      {/* Header with status and Sound Toggle */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-cyan-500/20 bg-black/20">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-cyan-400" />
          <span className="font-mono text-xs font-bold text-cyan-300 tracking-wider">
            INTELLIGENCE STREAM
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            ({messages.length} messages)
          </span>

          {/* 🔊 JIN Speaker Voice Toggle */}
          <button
            type="button"
            onClick={handleToggleSpeaker}
            title={`JIN Speaker: ${speakerEnabled ? 'ON (JIN berbicara)' : 'OFF (JIN hening di layar)'} (Klik untuk mengubah)`}
            className={`ml-2 px-2.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 border transition-all ${
              speakerEnabled
                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,229,255,0.25)]'
                : 'bg-slate-950/70 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {speakerEnabled ? <Volume2 size={10} className="text-cyan-300" /> : <VolumeX size={10} />}
            <span>SPEAKER {speakerEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* ⌨️ Keystroke Typing Sound Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={`Suara Ketikan: ${soundEnabled ? 'ON' : 'OFF'}`}
            className={`px-2 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 border transition-all ${
              soundEnabled
                ? 'bg-cyan-950/50 border-cyan-500/30 text-cyan-400/80'
                : 'bg-slate-950/70 border-slate-800 text-slate-500'
            }`}
          >
            <span>SFX {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'streaming'
                ? 'bg-cyan-400 animate-ping'
                : status === 'sending'
                ? 'bg-amber-400 animate-pulse'
                : status === 'error'
                ? 'bg-red-400'
                : 'bg-emerald-400'
            }`}
          />
          <span className="font-mono text-[10px] text-slate-400 tracking-wider uppercase">
            {status === 'idle' && 'JIN ONLINE'}
            {status === 'sending' && 'CONNECTING...'}
            {status === 'streaming' && 'STREAMING RESPONSE...'}
            {status === 'completed' && 'RESPONSE COMPLETE'}
            {status === 'error' && 'SYSTEM ERROR'}
          </span>
        </div>
      </div>

      {/* Error notification banner if any */}
      {error && (
        <div className="bg-red-950/80 border-b border-red-500/40 px-4 py-1.5 text-red-300 text-[11px] font-mono flex items-center gap-2">
          <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Ticker History */}
      <TickerHistory messages={messages} activeStreamingId={activeStreamingId} />

      {/* Ticker Input */}
      <TickerInput onSend={handleSend} status={status} onClear={handleClear} />
    </div>
  );
}
