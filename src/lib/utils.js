/**
 * Utility functions for the application
 */

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import i18n from './i18n';

/**
 * Merge class names with Tailwind conflict resolution
 * @param  {...any} inputs - Class names to merge
 * @returns {string} - Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format phone number for display (Turkish format)
 * @param {string} phone - Raw phone number
 * @returns {string} - Formatted phone number
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9)}`;
  }
  return phone;
}

/**
 * Mask phone number as user types (Turkish format: 5XX XXX XX XX)
 * @param {string} value - Raw input value
 * @returns {string} - Masked phone number
 */
export function maskPhone(value) {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
  if (!match) return cleaned;
  
  const parts = [match[1], match[2], match[3], match[4]].filter(Boolean);
  
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  if (parts.length === 3) return `${parts[0]} ${parts[1]} ${parts[2]}`;
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date (DD.MM.YYYY)
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date with time for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted datetime (DD.MM.YYYY HH:mm)
 */
export function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: TRY)
 * @returns {string} - Formatted currency
 */
export function formatCurrency(amount, currency = 'TRY') {
  if (amount == null) return '';
  return new Intl.NumberFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

const CURRENCY_SYMBOLS = { TRY: '₺', USD: '$', EUR: '€', CHF: 'Fr.' };

/**
 * Get currency symbol for display (e.g. input prefix)
 * @param {string} currency - Currency code (TRY, USD, EUR, CHF)
 * @returns {string} - Symbol (₺, $, €, Fr.)
 */
export function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} - Initials (max 2 characters)
 */
export function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 * @param {any} value - Value to check
 * @returns {boolean} - Whether the value is empty
 */
export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text with ellipsis
 */
export function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get relative time string (e.g., "5 dakika önce")
 * @param {string|Date} date - Date to compare
 * @returns {string} - Relative time string
 */
export function getRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return i18n.t('common:time.justNow');
  if (diffMins < 60) return i18n.t('common:time.minutesAgo', { count: diffMins });
  if (diffHours < 24) return i18n.t('common:time.hoursAgo', { count: diffHours });
  if (diffDays < 7) return i18n.t('common:time.daysAgo', { count: diffDays });
  return formatDate(date);
}

/**
 * Status badge variant mapping for work orders
 */
export const workOrderStatusVariant = {
  pending: 'warning',
  scheduled: 'info',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'default',
};

/**
 * Status badge variant mapping for tasks
 */
export const taskStatusVariant = {
  pending: 'warning',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'default',
};

/**
 * Priority badge variant mapping
 */
export const priorityVariant = {
  low: 'default',
  normal: 'default',
  high: 'warning',
  urgent: 'error',
};

export const subscriptionStatusVariant = {
  active: 'success',
  paused: 'warning',
  cancelled: 'default',
};

export const proposalStatusVariant = {
  draft: 'default',
  sent: 'info',
  accepted: 'success',
  rejected: 'error',
  cancelled: 'default',
  completed: 'primary',
};

export const paymentStatusVariant = {
  pending: 'default',
  paid: 'success',
  failed: 'error',
  skipped: 'info',
  write_off: 'warning',
};
