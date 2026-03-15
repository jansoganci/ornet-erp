import { z } from 'zod';

import i18n from '../../lib/i18n';

const isoDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Geçerli bir tarih giriniz (YYYY-AA-GG)'
);
const timeSchema = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  'Geçerli bir saat giriniz (SS:DD)'
);

export const taskSchema = z.object({
  title: z.string().min(1, i18n.t('errors:validation.required')),
  description: z.string().optional().or(z.literal('')),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  due_date: isoDateSchema.optional().or(z.literal('')),
  due_time: timeSchema.optional().or(z.literal('')),
  work_order_id: z.string().uuid().optional().or(z.literal('')),
});
