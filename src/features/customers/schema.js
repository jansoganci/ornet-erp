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
  identity_type: z.enum(['vkn', 'tckn']).optional().or(z.literal('')),
  tax_office: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.tax_number?.trim() && !data.identity_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['identity_type'],
      message: i18n.t('errors:validation.required'),
    });
  }
});

export const customerDefaultValues = {
  company_name: '',
  subscriber_title: '',
  phone: '',
  phone_secondary: '',
  email: '',
  tax_number: '',
  identity_type: '',
  tax_office: '',
  notes: '',
};

// Optional first site fields (create flow only) - same structure as customerSites/schema
const sitePhoneSchema = z
  .string()
  .regex(/^[0-9+\s\-()]{7,20}$/, 'Geçerli bir telefon numarası giriniz')
  .optional()
  .or(z.literal(''));

export const firstSiteSchema = z.object({
  first_site_site_name: z.string().max(200).optional().or(z.literal('')),
  first_site_account_no: z.string().max(50).optional().or(z.literal('')),
  first_site_address: z.string().max(1000).optional().or(z.literal('')),
  first_site_city: z.string().max(200).optional().or(z.literal('')),
  first_site_district: z.string().max(200).optional().or(z.literal('')),
  first_site_contact_name: z.string().max(200).optional().or(z.literal('')),
  first_site_contact_phone: sitePhoneSchema,
  first_site_alarm_center: z.string().max(200).optional().or(z.literal('')),
  first_site_panel_info: z.string().max(1000).optional().or(z.literal('')),
  first_site_connection_date: z.string().optional().or(z.literal('')),
  first_site_notes: z.string().max(1000).optional().or(z.literal('')),
});

export const customerCreateSchema = customerSchema.merge(firstSiteSchema);

export const customerCreateDefaultValues = {
  ...customerDefaultValues,
  first_site_site_name: '',
  first_site_account_no: '',
  first_site_address: '',
  first_site_city: '',
  first_site_district: '',
  first_site_contact_name: '',
  first_site_contact_phone: '',
  first_site_alarm_center: '',
  first_site_panel_info: '',
  first_site_connection_date: '',
  first_site_notes: '',
};
