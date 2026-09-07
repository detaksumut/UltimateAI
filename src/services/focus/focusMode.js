/**
 * focusMode.js
 * Reusable JIN Focus Mode state machine for the Crystal/HUD dashboard.
 *
 * When a focus panel opens (LIVE CONVERSATION, MEDIA, DETAIL PANEL, SUMMARY,
 * EXPANDED PANEL, studio, evidence chain, etc.) the MAIN DASHBOARD behind it is
 * moved to a background state: DIM or DEEP_FOCUS. The dashboard is never removed
 * from the DOM and never hidden by default — it stays alive behind the panel,
 * then returns to its exact prior state when the panel closes (no reload).
 *
 * States:
 *   NORMAL      → dashboard fully visible & interactive (opacity 1, no blur).
 *   DIM         → dashboard dimmed + light blur (default background state).
 *   DEEP_FOCUS  → dashboard strongly dimmed + blurred + interaction locked
 *                 (opacity ~0.15, blur 8–16px, pointer-events none).
 *
 * The controller is multi-tenant: multiple panels can be open at once; the
 * active intensity is the highest among all currently held focus demands.
 * Closing one panel never undims while another is still open.
 */

export const FOCUS_NORMAL = 'NORMAL';
export const FOCUS_DIM = 'DIM';
export const FOCUS_DEEP = 'DEEP_FOCUS';

const INTENSITY = { [FOCUS_NORMAL]: 0, [FOCUS_DIM]: 1, [FOCUS_DEEP]: 2 };
const STATE_NAME = ['NORMAL', 'DIM', 'DEEP_FOCUS'];

class FocusModeController {
  constructor() {
    this._scopes = new Map(); // scopeId -> intensity string
    this._state = FOCUS_NORMAL;
    this._listeners = new Set();
  }

  /** Hold a focus demand for a scope. Multiple scopes may hold simultaneously. */
  setFocus(scopeId, intensity = FOCUS_DEEP) {
    if (!scopeId || !INTENSITY[intensity]) return;
    this._scopes.set(scopeId, intensity);
    this._recompute();
  }

  /** Release a held focus demand. Others (if any) keep the dashboard dimmed. */
  releaseFocus(scopeId) {
    if (this._scopes.delete(scopeId)) this._recompute();
  }

  /** Clear all focus demands (e.g. full reset). */
  clear() {
    if (this._scopes.size === 0) return;
    this._scopes.clear();
    this._recompute();
  }

  /** Whether any focus demand is currently active. */
  get isActive() {
    return this._state !== FOCUS_NORMAL;
  }

  get state() {
    return this._state;
  }

  /** Number of currently held focus demands. */
  get scopeCount() {
    return this._scopes.size;
  }

  _recompute() {
    let top = FOCUS_NORMAL;
    for (const intensity of this._scopes.values()) {
      if (INTENSITY[intensity] > INTENSITY[top]) top = intensity;
    }
    if (top !== this._state) {
      this._state = top;
      this._notify();
    }
  }

  subscribe(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _notify() {
    this._listeners.forEach((cb) => {
      try {
        cb(this._state, STATE_NAME[INTENSITY[this._state]]);
      } catch (e) {
        // never let one listener break the rest
      }
    });
  }
}

export const focusModeController = new FocusModeController();
export default focusModeController;
