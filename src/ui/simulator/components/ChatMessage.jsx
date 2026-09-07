import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Download } from 'lucide-react';

// Split text into segments: plain text and URLs
function splitByUrls(text) {
  if (!text) return [];
  const segments = [];
  const urlRegex = /(https?:\/\/[^\s<\])]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'url', value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

// Render text with clickable URLs
function renderContent(text) {
  if (!text) return null;

  // Process code blocks first
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let cbMatch;

  while ((cbMatch = codeBlockRegex.exec(text)) !== null) {
    // Text before code block
    if (cbMatch.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, cbMatch.index) });
    }
    parts.push({ type: 'codeblock', lang: cbMatch[1] || 'javascript', code: cbMatch[2] });
    lastIndex = cbMatch.index + cbMatch[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', content: text });
  }

  return parts.map((part, i) => {
    if (part.type === 'codeblock') {
      const rt = part.lang.toLowerCase();
      const label = rt === 'python' || rt === 'py' ? 'Python' : rt === 'powershell' || rt === 'ps' ? 'PowerShell' : 'Node.js';
      const val = rt === 'python' || rt === 'py' ? 'python' : rt === 'powershell' || rt === 'ps' ? 'powershell' : 'node';
      return React.createElement('div', { key: i, className: 'code-block-wrapper', 'data-runtime': val },
        React.createElement('div', { className: 'code-block-header' },
          React.createElement('span', { className: 'code-lang' }, label),
          React.createElement('div', { className: 'code-actions' },
            React.createElement('button', { className: 'code-copy-btn' }, 'Copy'),
            React.createElement('button', { className: 'code-run-btn' }, 'Run')
          )
        ),
        React.createElement('pre', null, React.createElement('code', null, part.code))
      );
    }

    // Text segment — split by newlines and URLs
    const lines = part.content.split('\n');
    return lines.map((line, li) => {
      const elements = [];
      if (li > 0) elements.push(React.createElement('br', { key: `br-${i}-${li}` }));

      const segments = splitByUrls(line);
      segments.forEach((seg, si) => {
        if (seg.type === 'url') {
          elements.push(
            React.createElement('a', {
              key: `link-${i}-${li}-${si}`,
              href: seg.value,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { color: '#22d3ee', textDecoration: 'underline', cursor: 'pointer' }
            }, seg.value)
          );
        } else {
          // Process inline formatting
          let formatted = seg.value;
          formatted = formatted.replace(/`([^`]+)`/g, '⟨$1⟩');
          formatted = formatted.replace(/\*\*(.*?)\*\*/g, '**$1**');
          formatted = formatted.replace(/\*(.*?)\*/g, '*$1*');

          if (formatted.includes('**') || formatted.includes('*') || formatted.includes('⟨')) {
            // Has formatting — split further
            const inlineParts = [];
            const inlineRegex = /(\*\*.*?\*\*|\*.*?\*|⟨[^⟩]+⟩)/g;
            let inlineLast = 0;
            let inlineMatch;
            while ((inlineMatch = inlineRegex.exec(formatted)) !== null) {
              if (inlineMatch.index > inlineLast) {
                inlineParts.push({ type: 'plain', text: formatted.slice(inlineLast, inlineMatch.index) });
              }
              const m = inlineMatch[0];
              if (m.startsWith('**')) {
                inlineParts.push({ type: 'bold', text: m.slice(2, -2) });
              } else if (m.startsWith('*') && !m.startsWith('**')) {
                inlineParts.push({ type: 'italic', text: m.slice(1, -1) });
              } else if (m.startsWith('⟨')) {
                inlineParts.push({ type: 'code', text: m.slice(1, -1) });
              }
              inlineLast = inlineMatch.index + m.length;
            }
            if (inlineLast < formatted.length) {
              inlineParts.push({ type: 'plain', text: formatted.slice(inlineLast) });
            }

            inlineParts.forEach((ip, ipi) => {
              if (ip.type === 'bold') {
                elements.push(React.createElement('strong', { key: `b-${i}-${li}-${si}-${ipi}` }, ip.text));
              } else if (ip.type === 'italic') {
                elements.push(React.createElement('em', { key: `em-${i}-${li}-${si}-${ipi}` }, ip.text));
              } else if (ip.type === 'code') {
                elements.push(React.createElement('code', { key: `c-${i}-${li}-${si}-${ipi}`, style: { background: 'rgba(0,229,255,0.1)', padding: '2px 6px', borderRadius: '3px' } }, ip.text));
              } else {
                elements.push(ip.text);
              }
            });
          } else {
            elements.push(seg.value);
          }
        }
      });

      return elements;
    });
  });
}

export default function ChatMessage({ msg, isTyping, onComplete }) {
  const isUser = msg.role === 'user';
  const [revealed, setRevealed] = useState(0);
  const indexRef = useRef(0);
  const timerRef = useRef(null);

  const fullText = msg.content || '';
  const len = fullText.length;
  // Natural cyber typewriter ticker pacing: 1-2 chars per tick
  const chunk = len > 600 ? 3 : len > 250 ? 2 : 1;
  const intervalMs = 30;

  const isStreaming = Boolean(msg.isStreaming);

  useEffect(() => {
    if (!isTyping || isStreaming || isUser || len === 0) {
      setRevealed(len);
      return;
    }
    indexRef.current = 0;
    setRevealed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      indexRef.current += chunk;
      if (indexRef.current >= len) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setRevealed(len);
        if (onComplete) onComplete();
        return;
      }
      setRevealed(indexRef.current);
    }, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fullText, isTyping, isStreaming, isUser, chunk, intervalMs]);

  const displayText = isUser || isStreaming || !isTyping || revealed >= len ? fullText : fullText.slice(0, revealed);
  const content = useMemo(() => renderContent(displayText), [displayText]);
  const showCursor = (isStreaming || (isTyping && revealed < len)) && !isUser;

  return (
    <div className={`stream-msg ${isUser ? 'stream-msg-user' : ''}`}>
      <div className="stream-msg-header">
        <span className={`stream-msg-label ${isUser ? 'stream-msg-label-user' : 'stream-msg-label-jin'}`}>
          {isUser ? '[USER]' : '[JIN]'}
        </span>
        <span className="stream-msg-divider" />
        <span className="stream-msg-time">{msg.timestamp || ''}</span>
      </div>
      {msg.imageUrl && (
        <div style={{ marginBottom: 12 }} className="stream-image-container">
          <img 
            src={msg.imageUrl} 
            alt="Generated Slide Visual" 
            style={{ maxWidth: '100%', borderRadius: 4, border: '1px solid rgba(0,229,255,0.25)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} 
            onClick={() => window.open(msg.imageUrl, '_blank')} 
          />
          <div className="flex items-center justify-between mt-1.5 px-1 text-[9px] font-mono">
            <span className="text-cyan-400/80">Format: 16:9 HD Presentation</span>
            <a 
              href={msg.imageUrl} 
              download={`slide_${Date.now()}.jpg`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 font-mono transition-colors"
              title="Download gambar slide ini ke laptop Anda"
            >
              <Download className="w-2.5 h-2.5 text-cyan-400" />
              <span>Unduh Slide</span>
            </a>
          </div>
        </div>
      )}
      <div className="stream-msg-body">
        {content}
        {showCursor && <span className="stream-cursor" />}
      </div>
      {msg.execResults && Object.entries(msg.execResults).map(([blockId, result]) => (
        <div key={blockId} className="stream-exec-result">
          {result.running ? <div className="stream-exec-running">Executing...</div> : (
            <>
              <div className={`stream-exec-header ${result.success ? 'stream-exec-ok' : 'stream-exec-err'}`}>
                {result.success ? 'OK' : 'ERR'} &bull; {result.durationMs}ms
              </div>
              {result.stdout && <pre className="stream-exec-output stream-exec-stdout">{result.stdout}</pre>}
              {result.stderr && <pre className="stream-exec-output stream-exec-stderr">{result.stderr}</pre>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
