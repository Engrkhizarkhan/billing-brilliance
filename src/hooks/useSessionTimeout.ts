import { useEffect, useRef, useState, useCallback } from 'react';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const WARNING_MS = 25 * 60 * 1000; // 25 min

export const useSessionTimeout = (onLogout: () => void) => {
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef<number>();
  const warningRef = useRef<number>();

  const resetTimers = useCallback(() => {
    setShowWarning(false);
    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
    warningRef.current = window.setTimeout(() => setShowWarning(true), WARNING_MS);
    timeoutRef.current = window.setTimeout(onLogout, TIMEOUT_MS);
  }, [onLogout]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimers));
    resetTimers();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimers));
      clearTimeout(timeoutRef.current);
      clearTimeout(warningRef.current);
    };
  }, [resetTimers]);

  return { showWarning, dismissWarning: resetTimers };
};
