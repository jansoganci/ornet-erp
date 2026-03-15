import * as Sentry from "@sentry/react";
import i18n from './i18n';

/**
 * Parses various error formats (Supabase, Network, etc.) and returns a localized message.
 * Also logs the error to Sentry in production.
 * @param {any} error - The error object to parse
 * @param {string} fallbackKey - The i18n key to use if no specific error is identified
 * @returns {string} - The localized error message
 */
export function getErrorMessage(error, fallbackKey = 'common.unexpected') {
  if (!error) return i18n.t(`errors:${fallbackKey}`);

  // Log to Sentry in production
  if (import.meta.env.PROD) {
    Sentry.captureException(error);
  }

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

  // PostgreSQL constraint errors (Supabase exposes error.code)
  const code = error?.code ?? error?.error?.code ?? '';
  const msg = error?.message ?? error?.error?.message ?? '';

  // 23505 = unique violation; 409 = Conflict (Supabase REST)
  if (String(code) === '23505' || error?.status === 409) {
    if (/idx_subscriptions_active_site|subscriptions.*unique|subscription.*duplicate/i.test(msg)) {
      return i18n.t('errors:subscriptions.duplicateActive');
    }
    return i18n.t('errors:db.duplicate');
  }

  const pgCodes = {
    '23503': 'errors:db.foreignKey',
    '23502': 'errors:db.notNull',
    '23514': 'errors:db.checkViolation',
    '22P02': 'errors:db.invalidFormat',
  };
  if (pgCodes[String(code)]) {
    return i18n.t(pgCodes[String(code)]);
  }

  // Use the error message if it exists, otherwise fallback
  return error.message || i18n.t(`errors:${fallbackKey}`);
}
