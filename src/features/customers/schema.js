import { z } from 'zod';
import i18n from '../../lib/i18n';

export const customerSchema = z.object({
  company_name: z.string().min(1, i18n.t('errors:validation.required')),
  phone: z.string().optional().or(z.literal('')),
  phone_secondary: z.string().optional().or(z.literal('')),
  email: z.string().email(i18n.t('errors:validation.email')).optional().or(z.literal('')),
  tax_number: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const customerDefaultValues = {
  company_name: '',
  phone: '',
  phone_secondary: '',
  email: '',
  tax_number: '',
  notes: '',
};
