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

export const WORK_TYPES = ['survey', 'installation', 'service', 'maintenance', 'other'];
export const CURRENCIES = ['TRY', 'USD'];

export const workOrderSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  form_no: z.string().optional().or(z.literal('')),
  work_type: z.enum(WORK_TYPES),
  work_type_other: z.string().max(30).optional().or(z.literal('')),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  scheduled_date: isoDateSchema.optional().or(z.literal('')),
  scheduled_time: timeSchema.optional().or(z.literal('')),
  assigned_to: z.array(z.string()).min(0).max(3, i18n.t('workOrders:validation.assignedToMax')),
  description: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  amount: z.preprocess((val) => (val === '' ? undefined : Number(val)), z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).optional()),
  currency: z.enum(['TRY', 'USD']).default('TRY'),
  items: z.array(z.object({
    description: z.string().min(1, i18n.t('errors:validation.required')),
    quantity: z.coerce.number().positive(),
    unit: z.enum([
      'adet', 'boy', 'paket', 'metre', 'mm', 'V', 'A', 'W',
      'MHz', 'TB', 'MP', 'port', 'kanal', 'inç', 'rpm', 'bölge',
    ]).default('adet'),
    unit_price: z.coerce.number().min(0),
    material_id: z.string().uuid().optional().nullable().or(z.literal('')),
    cost: z.coerce.number().min(0).optional().nullable(),
  })).min(0),
  materials_discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
}).refine((data) => {
  if (data.work_type === 'other') {
    return data.work_type_other && data.work_type_other.length > 0;
  }
  return true;
}, {
  message: i18n.t('workOrders:validation.workTypeOtherRequired'),
  path: ['work_type_other'],
}).refine((data) => {
  if (data.work_type !== 'survey' && data.items.length === 0) {
    return false;
  }
  return true;
}, {
  message: i18n.t('errors:validation.required'),
  path: ['items'],
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
  items: [
    { description: '', quantity: 1, unit: 'adet', unit_price: 0, material_id: null, cost: null },
  ],
  materials_discount_percent: 0,
};
