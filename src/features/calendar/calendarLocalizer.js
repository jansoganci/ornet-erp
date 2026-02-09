import { format, startOfWeek, getDay } from 'date-fns';
import { dateFnsLocalizer } from 'react-big-calendar';
import tr from 'date-fns/locale/tr';
import enUS from 'date-fns/locale/en-US';

const locales = {
  tr,
  'en-US': enUS,
};

export const calendarLocalizer = dateFnsLocalizer({
  format,
  startOfWeek,
  getDay,
  locales,
});

/**
 * Map i18n language to react-big-calendar culture (date-fns locale key).
 */
export function getCalendarCulture(lng) {
  if (lng === 'en') return 'en-US';
  return lng || 'tr';
}
