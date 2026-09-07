/**
 * useFocusMode.js
 * React binding for the reusable JIN Focus Mode controller.
 *
 * Returns the current focus mode + ready-to-apply class names so any component
 * can react to the dashboard's background state without duplicating logic.
 */
import { useEffect, useState } from 'react';
import {
  focusModeController,
  FOCUS_DIM,
  FOCUS_DEEP
} from '../services/focus/focusMode.js';

export function useFocusMode() {
  const [mode, setMode] = useState(() => focusModeController.state);

  useEffect(() => {
    const unsub = focusModeController.subscribe((state) => setMode(state));
    return unsub;
  }, []);

  const isBackground = mode !== 'NORMAL';
  const isDeep = mode === FOCUS_DEEP;

  // CSS class for the main dashboard background layer.
  const dashboardClass = isBackground ? 'is-background' : 'is-normal';

  return {
    mode,
    isBackground,
    isDeep,
    dashboardClass,
    setFocus: focusModeController.setFocus.bind(focusModeController),
    releaseFocus: focusModeController.releaseFocus.bind(focusModeController),
    focusModeController
  };
}

export { FOCUS_DIM, FOCUS_DEEP };
export default useFocusMode;
