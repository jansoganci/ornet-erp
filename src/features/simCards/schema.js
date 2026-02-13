import { z } from 'zod';
import i18n from '../../lib/i18n';

export const simCardSchema = z.object({
  phone_number: z.string().min(1, i18n.t('simCards:form.validation.phoneNumberRequired')),
  imsi: z.string().optional().or(z.literal('')),
  iccid: z.string().optional().or(z.literal('')),
  operator: z.enum(['TURKCELL', 'VODAFONE', 'TURK_TELEKOM'], {
    errorMap: () => ({ message: i18n.t('simCards:form.validation.operatorRequired') }),
  }),
  capacity: z.string().optional().or(z.literal('')),
  account_no: z.string().optional().or(z.literal('')),
  status: z.enum(['available', 'active', 'subscription', 'cancelled']),
  customer_id: z.string().uuid().nullable().optional(),
  site_id: z.string().uuid().nullable().optional(),
  cost_price: z.number().min(0).default(0),
  sale_price: z.number().min(0).default(0),
  currency: z.string().default('TRY'),
  notes: z.string().optional().or(z.literal('')),
});

export const simCardDefaultValues = {
  phone_number: '',
  imsi: '',
  iccid: '',
  operator: 'TURKCELL',
  capacity: '',
  account_no: '',
  status: 'available',
  customer_id: null,
  site_id: null,
  cost_price: 0,
  sale_price: 0,
  currency: 'TRY',
  notes: '',
};
