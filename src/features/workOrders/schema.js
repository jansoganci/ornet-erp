import { z } from 'zod';
import i18n from '../../lib/i18n';

export const WORK_TYPES = ['survey', 'installation', 'service', 'maintenance', 'other'];

export const workOrderSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')),
  form_no: z.string().optional().or(z.literal('')),
  work_type: z.enum(WORK_TYPES),
  work_type_other: z.string().max(30).optional().or(z.literal('')),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  scheduled_date: z.string().optional().or(z.literal('')),
  scheduled_time: z.string().optional().or(z.literal('')),
  assigned_to: z.array(z.string()).min(0).max(3, i18n.t('workOrders:validation.assignedToMax')),
  description: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  amount: z.preprocess((val) => (val === '' ? undefined : Number(val)), z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).optional()),
  currency: z.string().default('TRY'),
  materials: z.array(z.object({
    material_id: z.string(),
    quantity: z.number().min(0),
    notes: z.string().optional().or(z.literal('')),
    material: z.any().optional(),
  })).default([]),
}).refine((data) => {
  if (data.work_type === 'other') {
    return data.work_type_other && data.work_type_other.length > 0;
  }
  return true;
}, {
  message: i18n.t('workOrders:validation.workTypeOtherRequired'),
  path: ['work_type_other'],
});

export const workOrderDefaultValues = {
  site_id: '',
  form_no: '',
  work_type: 'service',
  work_type_other: '',
  status: 'pending',
  priority: 'normal',
  scheduled_date: '',
  scheduled_time: '',
  assigned_to: [],
  description: '',
  notes: '',
  amount: '',
  currency: 'TRY',
  materials: [],
};
