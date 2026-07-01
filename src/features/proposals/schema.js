import { z } from 'zod';
import i18n from '../../lib/i18n';

const optionalNum = () => z.coerce.number().min(0).optional().nullable();
const optionalStr = () => z.string().optional().or(z.literal(''));
const toNumber = (val) => (val === '' || val === undefined || val === null ? undefined : Number(val));

const annualQtyPreprocess = (val) =>
  val === '' || val === null || val === undefined ? 1 : val;

export const CURRENCIES = ['TRY', 'USD'];

export const ANNUAL_FIXED_COST_CURRENCIES = ['TRY', 'USD', 'EUR'];

/** DB / legacy materials may store units outside this list; coerce to a safe default. */
export const PROPOSAL_ITEM_UNITS = [
  'adet', 'boy', 'paket', 'metre', 'mm', 'V', 'A', 'W',
  'MHz', 'TB', 'MP', 'port', 'kanal', 'inç', 'rpm', 'bölge',
  'set', 'takim',
];

export const ANNUAL_FIXED_COST_PRESETS = [
  'Alarm İzleme Hizmet Bedeli',
  'SMS Hizmet Bedeli',
  'İnternet Hizmet Bedeli',
  'Mobil Uygulama Lisans Bedeli',
  'Merkez İzleme Hizmet Bedeli',
  'Bakım ve Destek Hizmet Bedeli',
  'Yazılım Lisans Bedeli',
  'Hat Kira Bedeli',
];

export const PROPOSAL_ITEM_UNIT_SET = new Set(PROPOSAL_ITEM_UNITS);

/**
 * Client-side only: each section gets a UUID generated at append time.
 * On edit load, _local_id is set to the DB section id so items can reference it.
 * Never sent to the server directly — api.js maps it to a real DB id after insert.
 */
export const proposalSectionSchema = z.object({
  _local_id: z.string(),
  title: z.string().default(''),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
});

export const proposalItemSchema = z.object({
  /** References a proposalSectionSchema._local_id; null = ungrouped */
  section_local_id: z.string().nullable().optional().default(null),
  description: z.string().min(1, i18n.t('errors:validation.required')),
  quantity: z.coerce.number().refine((n) => Number.isFinite(n) && n > 0, {
    message: i18n.t('errors:validation.quantityPositive'),
  }),
  unit: z.preprocess(
    (val) => (PROPOSAL_ITEM_UNIT_SET.has(val) ? val : 'adet'),
    z.enum([
      'adet', 'boy', 'paket', 'metre', 'mm', 'V', 'A', 'W',
      'MHz', 'TB', 'MP', 'port', 'kanal', 'inç', 'rpm', 'bölge',
      'set', 'takim',
    ]),
  ),
  unit_price: z.coerce.number().min(0),
  material_id: z.string().uuid().optional().nullable().or(z.literal('')),
  cost: z.coerce.number().min(0).optional().nullable(),
  margin_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  // Cost tracking (internal only, per-unit)
  product_cost: optionalNum(),
  labor_cost: optionalNum(),
  shipping_cost: optionalNum(),
  material_cost: optionalNum(),
  misc_cost: optionalNum(),
});

export const annualFixedCostRowSchema = z.object({
  description: z.string(),
  quantity: z.preprocess(annualQtyPreprocess, z.coerce.number().positive()),
  unit: z.string().default('adet'),
  unit_price: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0),
  ),
  currency: z.enum(['TRY', 'USD', 'EUR']).default('TRY'),
});

export const proposalSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  title: z.string().min(1, i18n.t('errors:validation.required')),
  scope_of_work: optionalStr(),
  notes: optionalStr(),
  discount_percent: z.coerce.number().min(0).max(100).optional().nullable(), // deprecated — per-section now
  terms_engineering: optionalStr(),
  terms_pricing: optionalStr(),
  terms_warranty: optionalStr(),
  terms_other: optionalStr(),
  terms_attachments: optionalStr(),
  has_vat: z.boolean().default(false),
  has_tevkifat: z.boolean().default(false),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(0)),
  currency: z.enum(['TRY', 'USD']).default('USD'),
  proposal_date: optionalStr(),
  survey_date: optionalStr(),
  authorized_person: optionalStr(),
  installation_date: optionalStr(),
  customer_representative: optionalStr(),
  completion_date: optionalStr(),
  sections: z.array(proposalSectionSchema).default([]),
  items: z.array(proposalItemSchema).min(1, i18n.t('errors:validation.required')),
  annual_fixed_costs: z.array(annualFixedCostRowSchema).default([]),
}).superRefine((data, ctx) => {
  const annual = data.annual_fixed_costs ?? [];
  annual.forEach((row, i) => {
    const desc = String(row.description ?? '').trim();
    const price = Number(row.unit_price) || 0;
    const qty = Number(row.quantity);

    if (!desc) {
      const blankRow =
        price === 0 &&
        Number.isFinite(qty) &&
        qty === 1;
      if (!blankRow) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['annual_fixed_costs', i, 'description'],
          message: i18n.t('errors:validation.required'),
        });
      }
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['annual_fixed_costs', i, 'quantity'],
        message: i18n.t('errors:validation.required'),
      });
    }
  });
});

export const defaultProposalItem = {
  section_local_id: null,
  description: '',
  quantity: 1,
  unit: 'adet',
  unit_price: 0,
  material_id: null,
  cost: null,
  margin_percent: null,
  product_cost: null,
  labor_cost: null,
  shipping_cost: null,
  material_cost: null,
  misc_cost: null,
};

// Default terms text (from ORNEK-TEKLIF-FORMU-010724.pdf) – user can edit or delete
const defaultTermsEngineering = `1. Sistemde uzak erişim için gerekli olan internet bağlantısının müşteri tarafında aktif olarak çalıştığı ve IP adresinin sabitlendiği kabul edilmiştir. Teklif bedeline internet altyapısına yönelik işlem veya işlemler dahil edilmemiştir. Gerekebilecek ilave işlemler ayrıca fiyatlandırılacaktır.
2. İnternet bağlantısının bulunmaması veya sağlıklı çalışmaması nedeniyle ilave servis ihtiyacı doğması halinde, ilgili hizmet ayrıca fiyatlandırılacaktır.
3. Sistemin montajı sırasında, yüklenici firmanın kontrolü dışında gelişen nedenlerden kaynaklanan gecikmeler ve tekrar servis gerektiren saha koşulları ayrıca fiyatlandırılacaktır.
4. Sistem montajı; sahadaki uç elemanlarının merkeze tanıtılmasını, kullanım için gerekli yazılım ve ayarların ilgili ürünlere yüklenmesini ve kullanıcı eğitimlerinin verilmesini kapsamaktadır.
5. Sistem montaj bedeli resmi mesai saatleri esas alınarak hesaplanmıştır. Mesai saatleri dışında talep edilecek montaj hizmetleri ayrıca fiyatlandırılacaktır.`;

const defaultTermsPricing = `1. Sistemde kullanılacak kablo ve kablo kanalı birim fiyatları belirtilmiş olup, fiili kullanım miktarına göre net metraj üzerinden faturalandırılacaktır.
2. Sistem, faturanın düzenlendiği tarihte geçerli olan TCMB Efektif Döviz Satış Kuru esas alınarak faturalandırılır.
3. Belirtilen fiyatlar peşin ödeme esasına göre hazırlanmıştır.
4. Ödeme planı şu şekildedir: sözleşme onayını takiben %40 avans, kablolama aşaması ve ürünlerin sahaya sevki sırasında %40, test, devreye alma ve nihai sistem tesliminde %20.
5. Fiyatlara KDV dahil değildir.`;

const defaultTermsWarranty = `1. Teklifte yer alan malzemeler, fatura tarihinden itibaren 24 ay süreyle üretim ve fabrikasyon hatalarına karşı garanti kapsamındadır.
2. Kullanıcı hataları, şebeke voltaj dalgalanmaları, yıldırım düşmesi ve dış etkenlerden kaynaklanan arızalar garanti kapsamı dışındadır.`;

const defaultTermsOther = `1. İşbu teklif, düzenlenme tarihinden itibaren 15 gün süreyle geçerlidir.
2. Müşteri; iş kabulünden sonra veya sistemin montaj aşamasında sözleşmenin feshedilmesi halinde, yapılan masraflar ile kablolama ve işçilik bedellerine karşılık, genel toplam tutarın %20’sini cayma tazminatı olarak ödemeyi kabul ve taahhüt eder. Bu tutar, önceden tahsil edilmiş avans ödemelerinden mahsup edilir.`;

const defaultTermsAttachments = `1. Fiyat Teklifi Detayları (Ürün ve Hizmet Listesi)`;

export const proposalDefaultValues = {
  site_id: '',
  title: '',
  scope_of_work: '',
  notes: '',
  currency: 'USD',
  proposal_date: '',
  survey_date: '',
  authorized_person: '',
  installation_date: '',
  customer_representative: '',
  completion_date: '',
  discount_percent: null,
  terms_engineering: defaultTermsEngineering,
  terms_pricing: defaultTermsPricing,
  terms_warranty: defaultTermsWarranty,
  terms_other: defaultTermsOther,
  terms_attachments: defaultTermsAttachments,
  has_vat: false,
  has_tevkifat: false,
  vat_rate: 0,
  sections: [],
  items: [],
  annual_fixed_costs: [],
  discount_percent: null,
};
