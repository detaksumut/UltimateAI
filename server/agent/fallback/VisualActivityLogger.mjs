/**
 * VisualActivityLogger.mjs
 * Structured activity logger for Gemini -> Hermes Visual Fallback pipeline.
 */

export class VisualActivityLogger {
  constructor() {
    this.events = [];
  }

  _formatTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  emitActivity(event = {}) {
    const timestamp = new Date();
    const timeStr = this._formatTime(timestamp);
    const entry = {
      timestamp,
      timeStr,
      ...event
    };
    this.events.push(entry);

    const phase = event.phase || event.component || 'IMAGE_GENERATION';
    const action = event.action || event.message || '';
    const status = event.status || '';

    // Human-friendly console trace matching Section 12
    if (status) {
      console.log(`[${timeStr}] ${phase}\n${action} → ${status}`);
    } else if (action) {
      console.log(`[${timeStr}] ${phase}\n${action}`);
    }

    return entry;
  }

  getEvents(requestId = null) {
    if (!requestId) return [...this.events];
    return this.events.filter(e => e.requestId === requestId);
  }

  clear() {
    this.events = [];
  }
}

export const visualActivityLoggerInstance = new VisualActivityLogger();
export default visualActivityLoggerInstance;
