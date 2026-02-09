import { z } from 'zod';

import i18n from '../../lib/i18n';

export const taskSchema = z.object({
  title: z.string().min(1, i18n.t('errors:validation.required')),
  description: z.string().optional().or(z.literal('')),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assigned_to: z.string().optional().or(z.literal('')),
  due_date: z.string().optional().or(z.literal('')),
  due_time: z.string().optional().or(z.literal('')),
  work_order_id: z.string().optional().or(z.literal('')),
});
