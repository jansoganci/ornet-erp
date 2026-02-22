import { useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Search input state with debouncing for API calls.
 * Keeps input responsive (immediate updates) while debouncing the value passed to queries.
 * Prevents focus loss from rapid re-renders/refetches.
 *
 * @param {object} options
 * @param {string} [options.initialValue=''] - Initial search value
 * @param {number} [options.debounceMs=300] - Debounce delay for API calls
 * @returns {{ search: string, setSearch: (v: string) => void, debouncedSearch: string }}
 */
export function useSearchInput({ initialValue = '', debounceMs = 300 } = {}) {
  const [search, setSearch] = useState(initialValue);
  const debouncedSearch = useDebouncedValue(search, debounceMs);

  return { search, setSearch, debouncedSearch };
}
