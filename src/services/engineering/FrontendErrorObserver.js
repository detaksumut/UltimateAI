/**
 * FrontendErrorObserver.js (v2 - Robust Map Structure, CORS-Safe & Defensive)
 *
 * Captures:
 * 1. Global JavaScript Errors
 * 2. Unhandled Promise Rejections
 * 3. Click Drop Events (mousedown -> click missing = dropped interaction)
 */

// Use relative API path (works with Vite dev server and direct gateway proxy)
const ENGINEERING_API = '/api/engineering/telemetry';

class FrontendErrorObserver {
  constructor() {
    this.active = false;
    this.clickTimestamps = new Map(); // Robust Map with iterable forEach
    this.clickDropCount = 0;
    this.totalClicks = 0;
  }

  start() {
    if (this.active) return;
    this.active = true;

    // 1. Global JavaScript Errors
    window.addEventListener('error', (event) => {
      if (!event.error && !event.message) return;
      this._send({
        type: 'ERROR',
        error: event.message || String(event.error),
        component: this._extractComponent(event),
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // 2. Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
      const msg = event.reason?.message || String(event.reason) || 'Unhandled promise rejection';
      this._send({
        type: 'UNHANDLED_REJECTION',
        error: msg,
        component: 'AsyncRuntime',
        metadata: { stack: event.reason?.stack }
      });
    });

    // 3. Click Drop Detection (mousedown â†’ click missing = drop)
    document.addEventListener('mousedown', (event) => {
      const target = event.target;
      if (!target) return;
      this.totalClicks++;
      if (this.clickTimestamps instanceof Map) {
        this.clickTimestamps.set(target, { time: Date.now(), target });
      }
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (this.clickTimestamps instanceof Map && this.clickTimestamps.has(target)) {
        this.clickTimestamps.delete(target);
      }
    }, true);

    // Defensive check for dropped clicks every 2 seconds
    setInterval(() => {
      const now = Date.now();
      if (this.clickTimestamps instanceof Map && typeof this.clickTimestamps.forEach === 'function') {
        this.clickTimestamps.forEach((data, element) => {
          if (data && (now - data.time > 1500)) {
            this.clickDropCount++;
            const successRate = this.totalClicks > 0
              ? Math.round(((this.totalClicks - this.clickDropCount) / this.totalClicks) * 100)
              : 100;
            this._send({
              type: 'CLICK_DROPPED',
              error: `Button click event dropped â€” DOM element became unstable during mousedown-to-click cycle.`,
              component: this._getComponentName(element),
              selector: element?.id ? `#${element.id}` : (element?.className || 'button'),
              severity: 'HIGH',
              metadata: {
                elementId: element?.id,
                elementTag: element?.tagName,
                clickSuccessRate: successRate,
                dropCount: this.clickDropCount
              }
            });
            this.clickTimestamps.delete(element);
          }
        });
      }
    }, 2000);

    console.log('ðŸ‘ï¸ [FrontendErrorObserver] Active. Monitoring errors, rejections & click drops.');
  }

  _extractComponent(event) {
    if (event.filename) {
      const match = event.filename.match(/components\/([^/]+)\.[jt]sx?$/);
      return match ? match[1] : 'UnknownComponent';
    }
    return 'GlobalScope';
  }

  _getComponentName(element) {
    let el = element;
    let depth = 0;
    while (el && depth < 10) {
      if (el.dataset?.component) return el.dataset.component;
      const id = el.id || '';
      if (id.includes('btn-nav')) return 'LeftSidebarHUD';
      el = el.parentElement;
      depth++;
    }
    return 'UnknownComponent';
  }

  async _send(payload) {
    try {
      await fetch(ENGINEERING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (_) {
      // Silently fail â€” observer must never crash the app
    }
  }

  stop() {
    this.active = false;
  }
}

export const frontendErrorObserver = new FrontendErrorObserver();
