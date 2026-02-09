import { z } from 'zod';
import i18n from '../../lib/i18n';

export const siteSchema = z.object({
  customer_id: z.string().min(1, i18n.t('errors:validation.required')),
  account_no: z.string().optional().or(z.literal('')),
  site_name: z.string().optional().or(z.literal('')),
  address: z.string().min(1, i18n.t('errors:validation.required')),
  city: z.string().optional().or(z.literal('')),
  district: z.string().optional().or(z.literal('')),
  contact_name: z.string().optional().or(z.literal('')),
  contact_phone: z.string().optional().or(z.literal('')),
  panel_info: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const siteDefaultValues = {
  customer_id: '',
  account_no: '',
  site_name: '',
  address: '',
  city: '',
  district: '',
  contact_name: '',
  contact_phone: '',
  panel_info: '',
  notes: '',
};
