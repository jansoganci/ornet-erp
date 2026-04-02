import { z } from 'zod';
import i18n from '../../lib/i18n';

const phoneSchema = z
  .string()
  .regex(/^[0-9+\s\-()]{7,20}$/, 'Geçerli bir telefon numarası giriniz')
  .optional()
  .or(z.literal(''));

export const siteSchema = z.object({
  customer_id: z.string().min(1, i18n.t('errors:validation.required')),
  account_no: z.string().max(50).optional().or(z.literal('')),
  site_name: z.string().max(200).optional().or(z.literal('')),
  site_type: z.enum(['residential', 'business']).optional().or(z.literal('')),
  alarm_center: z.string().max(200).optional().or(z.literal('')),
  address: z.string().max(1000).optional().or(z.literal('')),
  city: z.string().max(200).optional().or(z.literal('')),
  district: z.string().max(200).optional().or(z.literal('')),
  contact_name: z.string().max(200).optional().or(z.literal('')),
  contact_phone: phoneSchema,
  panel_info: z.string().max(1000).optional().or(z.literal('')),
  connection_date: z.string().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export const siteDefaultValues = {
  customer_id: '',
  account_no: '',
  site_name: '',
  site_type: '',
  alarm_center: '',
  address: '',
  city: '',
  district: '',
  contact_name: '',
  contact_phone: '',
  panel_info: '',
  connection_date: '',
  notes: '',
};
