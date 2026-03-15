import { z } from 'zod';

const isoDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Geçerli bir tarih giriniz (YYYY-AA-GG)'
);
const timeSchema = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  'Geçerli bir saat giriniz (SS:DD)'
);

export const reminderSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().max(500).optional().or(z.literal('')),
  remind_date: isoDateSchema,
  remind_time: timeSchema.optional().or(z.literal('')),
});

export const reminderDefaultValues = {
  title: '',
  content: '',
  remind_date: '',
  remind_time: '',
};
