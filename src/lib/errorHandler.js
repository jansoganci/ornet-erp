import i18n from './i18n';

/**
 * Parses various error formats (Supabase, Network, etc.) and returns a localized message.
 * @param {any} error - The error object to parse
 * @param {string} fallbackKey - The i18n key to use if no specific error is identified
 * @returns {string} - The localized error message
 */
export function getErrorMessage(error, fallbackKey = 'common.unexpected') {
  if (!error) return i18n.t(`errors:${fallbackKey}`);

  // Supabase error object
  if (error.status === 401) {
    return i18n.t('errors:auth.sessionExpired');
  }

  if (error.status === 403) {
    return i18n.t('errors:common.unauthorized');
  }

  // Network error
  if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
    return i18n.t('errors:common.networkError');
  }

  // Use the error message if it exists, otherwise fallback
  return error.message || i18n.t(`errors:${fallbackKey}`);
}
