/**
 * DB notification titles for work orders are built as:
 *   TRIM(form_no || ' ' || work_type::text)
 * work_type is stored in English (survey, installation, …). This helper swaps the
 * last token when it is a known work type so UI can show translated labels.
 */

const WORK_ORDER_TYPE_SLUGS = new Set(['survey', 'installation', 'service', 'maintenance', 'other']);

/**
 * @param {string|null|undefined} title
 * @param {(slug: string) => string} translateWorkType - e.g. (k) => t(`common:workType.${k}`)
 * @returns {string}
 */
export function localizeWorkOrderNotificationTitle(title, translateWorkType) {
  if (title == null) return '';
  const s = String(title).trim();
  if (!s) return '';
  const parts = s.split(/\s+/);
  const last = parts[parts.length - 1];
  if (!WORK_ORDER_TYPE_SLUGS.has(last)) return s;
  const label = translateWorkType(last);
  if (parts.length === 1) return label;
  return `${parts.slice(0, -1).join(' ')} ${label}`.trim();
}

/**
 * @param {string|null|undefined} title
 * @param {string|null|undefined} entityType
 * @param {(slug: string) => string} translateWorkType
 * @returns {string}
 */
export function localizeNotificationTitle(title, entityType, translateWorkType) {
  if (entityType === 'work_order') {
    return localizeWorkOrderNotificationTitle(title, translateWorkType);
  }
  return title == null ? '' : String(title);
}
