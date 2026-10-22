// ============================================================================
// JINI Simulator Widget — for beritaindonesia.news (WordPress)
// Embeds https://ultimate-ai-two.vercel.app/simulator below the TOP Menu.
// Lazy-loaded, non-blocking, responsive, no secrets in client-side JS.
// ============================================================================

(function () {
  'use strict';

  const SRC = 'https://ultimate-ai-two.vercel.app/simulator';
  const ID = 'jini-simulator-widget';
  const WRAPPER_CLASS = 'jini-simulator-wrapper';
  const FRAME_CLASS = 'jini-simulator-iframe';
  const PLACEHOLDER_CLASS = 'jini-simulator-placeholder';
  const ERROR_CLASS = 'jini-simulator-error';

  // Minimal inline CSS so the widget works even if theme stylesheets load late.
  const CSS = `
    .${WRAPPER_CLASS} {
      width: 100%;
      max-width: 1280px;
      margin: 24px auto 32px auto;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      background: #0b0f19;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .${PLACEHOLDER_CLASS} {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 60vh;
      min-height: 420px;
      color: #94a3b8;
      font-size: 1rem;
      background: #0b0f19;
      cursor: pointer;
      user-select: none;
    }
    .${FRAME_CLASS} {
      width: 100%;
      height: 70vh;
      min-height: 520px;
      border: 0;
      display: block;
      background: #0b0f19;
    }
    .${ERROR_CLASS} {
      padding: 24px;
      color: #ef4444;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      text-align: center;
      font-size: 0.95rem;
    }
    @media (max-width: 768px) {
      .${WRAPPER_CLASS} { margin: 16px auto 24px auto; border-radius: 8px; }
      .${PLACEHOLDER_CLASS} { height: auto; min-height: 300px; padding: 20px; text-align: center; }
      .${FRAME_CLASS} { height: 55vh; min-height: 420px; border-radius: 8px; }
    }
  `;

  function injectCSS() {
    const style = document.createElement('style');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildWrapper() {
    const wrap = document.createElement('div');
    wrap.id = ID;
    wrap.className = WRAPPER_CLASS;

    // Placeholder shown until the iframe is lazy-loaded (avoids layout shift).
    const placeholder = document.createElement('div');
    placeholder.className = PLACEHOLDER_CLASS;
    placeholder.innerHTML = '<span>⚡ Muat Simulator JINI</span>';
    placeholder.title = 'Klik untuk memuat simulator JINI';

    const frame = document.createElement('iframe');
    frame.id = ID + '-frame';
    frame.className = FRAME_CLASS;
    frame.title = 'JINI Neural Interface Simulator';
    frame.setAttribute('aria-label', 'Simulator JINI');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('decoding', 'async');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms');
    frame.style.display = 'none';

    let loaded = false;
    let attempted = false;

    function loadIframe() {
      if (loaded || attempted) return;
      attempted = true;
      frame.src = SRC;
      frame.style.display = 'block';
      placeholder.style.display = 'none';
      frame.onload = () => { loaded = true; };
      frame.onerror = () => {
        frame.style.display = 'none';
        const err = document.createElement('div');
        err.className = ERROR_CLASS;
        err.innerHTML = '<strong>Simulator JINI tidak tersedia saat ini.</strong><br>Silakan coba lagi nanti atau kunjungi langsung ultimate-ai-two.vercel.app/simulator.';
        wrap.appendChild(err);
      };
      // Keep placeholder click as a manual fallback trigger.
      placeholder.onclick = null;
    }

    // Auto-load when near viewport; click placeholder as fallback.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) loadIframe();
      });
    }, { rootMargin: '300px 0px' });

    placeholder.onclick = loadIframe;
    observer.observe(wrap);

    wrap.appendChild(placeholder);
    wrap.appendChild(frame);
    return wrap;
  }

  function insertBelowTopMenu() {
    if (document.getElementById(ID)) return; // already inserted

    injectCSS();
    const widget = buildWrapper();

    // Candidate injection points (in order of preference). WordPress themes
    // commonly expose the top menu via a <header>, .site-header, #masthead,
    // .top-menu, nav, or .navbar. We insert the widget right after the first
    // matching element found in <body>.
    const selectors = [
      'header', '.site-header', '#masthead', '.top-menu', '.topbar',
      '.navbar', 'nav', '.main-header', '.header-wrap'
    ];

    let target = null;
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      // Prefer the first element that is a direct-ish child of body / visible.
      for (const el of els) {
        if (el && el.parentElement) {
          target = el;
          break;
        }
      }
      if (target) break;
    }

    if (target && target.parentElement) {
      target.parentElement.insertBefore(widget, target.nextSibling);
    } else {
      // Fallback: append at start of <body> so it still appears prominently.
      document.body.prepend(widget);
    }
  }

  // Run when DOM is ready; defer so we don't block the page's critical path.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertBelowTopMenu);
  } else {
    insertBelowTopMenu();
  }
})();
