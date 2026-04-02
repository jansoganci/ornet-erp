import { z } from 'zod';
import i18n from '../../lib/i18n';

const toNumber = (val) => (val === '' || val === undefined || val === null ? undefined : Number(val));

export const simCardSchema = z.object({
  phone_number: z.string().regex(
    /^[0-9+\s\-()]{7,20}$/,
    'Geçerli bir telefon numarası giriniz'
  ),
  operator: z.enum(['TURKCELL', 'VODAFONE', 'TURK_TELEKOM'], {
    errorMap: () => ({ message: i18n.t('simCards:form.validation.operatorRequired') }),
  }),
  capacity: z.string().max(50).optional().or(z.literal('')),
  status: z.enum(['available', 'active', 'subscription', 'cancelled']),
  provider_company_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  site_id: z.string().uuid().nullable().optional(),
  imsi: z.string().regex(/^[A-Za-z0-9]{5}$/, 'IMSI 5 karakterli olmalıdır').optional().or(z.literal('')),
  gprs_serial_no: z.string().optional().or(z.literal('')),
  account_no: z.string().optional().or(z.literal('')),
  cost_price: z.number().min(0).default(0),
  sale_price: z.number().min(0).default(0),
  customer_label: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(0)),
});

export const simCardDefaultValues = {
  phone_number: '',
  operator: 'TURKCELL',
  capacity: '',
  status: 'available',
  provider_company_id: null,
  customer_id: null,
  site_id: null,
  imsi: '',
  gprs_serial_no: '',
  account_no: '',
  cost_price: 0,
  sale_price: 0,
  currency: 'TRY',
  customer_label: '',
  notes: '',
  vat_rate: 0,
};
