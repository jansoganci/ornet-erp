import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Hook to block navigation when a form has unsaved changes.
 *
 * useBlocker intercepts ALL internal navigation automatically:
 * sidebar NavLinks, browser back/forward, programmatic navigate().
 * beforeunload handles tab close and page refresh separately.
 *
 * Returns the native blocker object: { state, proceed, reset }
 */
export function useUnsavedChanges({ isDirty }) {
  // Block all internal navigation while form is dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Block tab close / page refresh (native browser dialog)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return blocker;
}
