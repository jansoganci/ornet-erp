import { z } from 'zod';
import i18n from '../../lib/i18n';

export const ASSET_TYPES = [
  'alarm_panel',
  'keypad',
  'motion_detector',
  'door_contact',
  'smoke_detector',
  'siren_indoor',
  'siren_outdoor',
  'camera_indoor',
  'camera_outdoor',
  'dvr_nvr',
  'monitor',
  'power_supply',
  'cable_run',
  'access_reader',
  'other',
];

export const ASSET_STATUSES = ['active', 'removed', 'replaced', 'faulty'];

export const WO_ASSET_ACTIONS = ['installed', 'serviced', 'removed', 'replaced', 'inspected'];

export const assetSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  customer_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  asset_type: z.enum(ASSET_TYPES, { required_error: i18n.t('errors:validation.required') }),
  brand: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  serial_number: z.string().optional().or(z.literal('')),
  material_id: z.string().uuid().optional().or(z.literal('')).or(z.null()),
  installed_at: z.string().optional().or(z.literal('')),
  location_note: z.string().optional().or(z.literal('')),
  warranty_expires_at: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const assetDefaultValues = {
  site_id: '',
  customer_id: '',
  asset_type: '',
  brand: '',
  model: '',
  serial_number: '',
  material_id: '',
  installed_at: '',
  location_note: '',
  warranty_expires_at: '',
  notes: '',
};

export const assetStatusVariant = {
  active: 'success',
  removed: 'default',
  replaced: 'info',
  faulty: 'error',
};
