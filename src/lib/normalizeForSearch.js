/**
 * Turkish character-insensitive search normalization.
 * Maps diacritics to ASCII equivalents for consistent search matching.
 * Use for both search terms and data when comparing (e.g. "boga gida" matches "Boğa Gıda").
 */
const TR_NORMALIZE_MAP = {
  'ğ': 'g', 'Ğ': 'G',
  'ş': 's', 'Ş': 'S',
  'ı': 'i', 'İ': 'I',
  'ö': 'o', 'Ö': 'O',
  'ü': 'u', 'Ü': 'U',
  'ç': 'c', 'Ç': 'C',
};

export function normalizeForSearch(value) {
  if (!value) return '';
  return String(value)
    .split('')
    .map((c) => TR_NORMALIZE_MAP[c] ?? c)
    .join('')
    .toLowerCase();
}
