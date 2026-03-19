import { z } from 'zod';
import i18n from '../../lib/i18n';

const t = (key) => i18n.t(key);

export const REGIONS = ['istanbul_europe', 'istanbul_anatolia', 'outside_istanbul'];
export const CONTACT_STATUSES = ['not_contacted', 'no_answer', 'confirmed', 'cancelled'];
export const REQUEST_STATUSES = ['open', 'scheduled', 'completed', 'failed', 'cancelled'];
export const WORK_TYPES = ['survey', 'installation', 'service', 'maintenance', 'other'];
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export const FAILURE_REASONS = [
  'customer_absent',
  'parts_needed',
  'access_denied',
  'incomplete_work',
  'other',
];

/**
 * Quick entry schema — minimal fields for phone call recording.
 * Customer + Site + Description. Everything else gets defaults.
 */
export const quickEntrySchema = z.object({
  customer_id: z.string().min(1, t('errors:validation.required')).uuid(),
  site_id: z.string().optional().or(z.literal('')),
  description: z.string().min(1, t('errors:validation.required')).max(1000),
  region: z.enum(REGIONS).default('istanbul_europe'),
  priority: z.enum(PRIORITIES).default('normal'),
  work_type: z.enum(WORK_TYPES).default('service'),
});

export const quickEntryDefaultValues = {
  customer_id: '',
  site_id: '',
  description: '',
  region: 'istanbul_europe',
  priority: 'normal',
  work_type: 'service',
};

/**
 * Inline scheduler schema — date + optional time + work type.
 */
export const scheduleSchema = z.object({
  scheduled_date: z.string().min(1, t('errors:validation.required')),
  scheduled_time: z.string().optional().or(z.literal('')),
  work_type: z.enum(WORK_TYPES).default('service'),
  notes: z.string().max(500).optional().or(z.literal('')),
});

export const scheduleDefaultValues = {
  scheduled_date: '',
  scheduled_time: '09:00',
  work_type: 'service',
  notes: '',
};

/**
 * Contact update schema — for Call Queue actions.
 */
export const contactUpdateSchema = z.object({
  contact_status: z.enum(CONTACT_STATUSES),
  contact_notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * Boomerang (failure) schema.
 */
export const failureSchema = z.object({
  failure_reason: z.enum(FAILURE_REASONS),
});
