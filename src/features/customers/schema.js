import { z } from 'zod';
import i18n from '../../lib/i18n';

const phoneSchema = z
  .string()
  .regex(/^[0-9+\s\-()]{7,20}$/, 'Geçerli bir telefon numarası giriniz')
  .optional()
  .or(z.literal(''));

export const customerSchema = z.object({
  company_name: z.string().min(1, i18n.t('errors:validation.required')).max(200),
  subscriber_title: z.string().max(500).optional().or(z.literal('')),
  phone: phoneSchema,
  phone_secondary: phoneSchema,
  email: z.string().email(i18n.t('errors:validation.email')).optional().or(z.literal('')),
  tax_number: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const customerDefaultValues = {
  company_name: '',
  subscriber_title: '',
  phone: '',
  phone_secondary: '',
  email: '',
  tax_number: '',
  notes: '',
};
