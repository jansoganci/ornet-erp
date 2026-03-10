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

export const OWNERSHIP_TYPES = ['company_owned', 'customer_owned'];

export const WO_ASSET_ACTIONS = ['installed', 'serviced', 'removed', 'replaced', 'inspected'];

// Optional string: accepts string, '', undefined; outputs string | undefined
const optionalString = z.union([z.string(), z.literal('')]).optional().transform((v) => (v === '' ? undefined : v));
// Optional nullable UUID: accepts uuid, '', null, undefined; outputs string | undefined
const optionalNullableUuid = z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform((v) => (v === '' || v === null ? undefined : v));
// Optional nullable enum: accepts enum, '', null, undefined; outputs string | undefined
const optionalNullableEnum = (enumValues) => z.union([z.enum(enumValues), z.literal(''), z.null()]).optional().transform((v) => (v === '' || v === null ? undefined : v));

export const assetSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  customer_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  asset_type: z.enum(ASSET_TYPES, { required_error: i18n.t('errors:validation.required') }),
  brand: optionalString,
  model: optionalString,
  serial_number: optionalString,
  material_id: optionalNullableUuid,
  installed_at: optionalString,
  location_note: optionalString,
  warranty_expires_at: optionalString,
  notes: optionalString,
  ownership_type: optionalNullableEnum(OWNERSHIP_TYPES),
  subscription_id: optionalNullableUuid,
  quantity: z.coerce.number().min(1).max(100).default(1),
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
  ownership_type: '',
  subscription_id: '',
  quantity: 1,
};

export const assetStatusVariant = {
  active: 'success',
  removed: 'default',
  replaced: 'info',
  faulty: 'error',
};

export const ownershipVariant = {
  company_owned: 'indigo',
  customer_owned: 'default',
};
