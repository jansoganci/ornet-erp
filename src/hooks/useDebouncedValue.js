import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of the value.
 * Useful for search inputs: display updates immediately, API calls use debounced value.
 *
 * @param {string} value - The value to debounce
 * @param {number} delayMs - Debounce delay in milliseconds
 * @returns {string} - The debounced value
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const tId = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(tId);
  }, [value, delayMs]);

  return debouncedValue;
}
