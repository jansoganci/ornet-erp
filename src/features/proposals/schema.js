import { z } from 'zod';
import i18n from '../../lib/i18n';

const optionalNum = () => z.coerce.number().min(0).optional().nullable();
const optionalStr = () => z.string().optional().or(z.literal(''));

export const CURRENCIES = ['TRY', 'USD'];

export const proposalItemSchema = z.object({
  description: z.string().min(1, i18n.t('errors:validation.required')),
  quantity: z.coerce.number().positive(),
  unit: z.string().default('adet'),
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

export const proposalSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')),
  title: z.string().min(1, i18n.t('errors:validation.required')),
  scope_of_work: optionalStr(),
  notes: optionalStr(),
  currency: z.string().default('USD'),
  items: z.array(proposalItemSchema).min(1, i18n.t('errors:validation.required')),
  // Header fields
  company_name: optionalStr(),
  proposal_date: optionalStr(),
  survey_date: optionalStr(),
  authorized_person: optionalStr(),
  installation_date: optionalStr(),
  customer_representative: optionalStr(),
  completion_date: optionalStr(),
  discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  terms_engineering: optionalStr(),
  terms_pricing: optionalStr(),
  terms_warranty: optionalStr(),
  terms_other: optionalStr(),
  terms_attachments: optionalStr(),
});

const defaultItem = {
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
const defaultTermsEngineering = `1) Sistem de uzak erişim için gerekecek olan internet müşteride çalışır ve IP'si sabitlenmiş halde olduğu kabul edilmiştir. Teklife internet için yapılacak işlem veya işlemlerin tutarı eklenmemiştir. Gerekebilecek olan ek işlemler için fiyatlandırma ayrıca yapılacaktır.
2) İnternet bağlantısının olmaması veya sağlıklı çalışmamasından dolayı tekrar servis gerekmesi halinde ayrıca fiyatlandırılacaktır.
3) Sistemin montajı için montajcı firmanın elinde olmayan bir sebep veya sebeplerden dolayı oluşan gecikmeler (tekrar gelmeyi gerektirecek durumlar) ayrıca fiyatlandırılacaktır.
4) Sistemin montajı sahadaki uç elemanlarının merkeze tanıtılmasını, kullanım için gerekli program ve ayarların istenilen ürünlere yüklenmesini ve kullanıcı eğitimlerinin verilmesini kapsamaktadır.
5) Sistemin montaj bedeli mesai saatleri için fiyatlandırılmıştır. Mesai saati dışı montaj istekleri farklı fiyatlandırılacaktır.`;

const defaultTermsPricing = `1) Sistemde kullanılacak kablo ve kablo kanalı birim fiyatları verilmiş olup kullanıldığı kadar faturalandırılacaktır.
2) Sistem iş tesliminde TCMB Efektif Döviz Satış Kuru esas alınarak faturalandırılır.
3) Fiyatlar peşin ödeme için verilmiştir.
4) Sözleşmenin onaylanmasına takiben montaj öncesi %40 kablolama ve ürün tesliminde %40 ve sistem tesliminde %20 şeklindedir.
5) Fiyatlara KDV dahil değildir.`;

const defaultTermsWarranty = `1) Teklifimizdeki malzemeler fatura tarihinden itibaren 24 ay süre ile orjinalden doğan (fabrikasyon) hatalarına karşı garantilidir.`;

const defaultTermsOther = `1) Teklifimiz taşıdığı tarihten itibaren 15 gün geçerlidir.
2) Müşteri iş kabulünden sonra veya sistemin montajı aşamasında; sözleşmenin feshi halinde kablolama ve işçilik bedeli karşılığı genel toplam tutarının %20 sini peşinen ödemeyi kabul ve taahhüt eder.`;

const defaultTermsAttachments = `1) Fiyat Teklifimiz.`;

export const proposalDefaultValues = {
  site_id: '',
  title: '',
  scope_of_work: '',
  notes: '',
  currency: 'USD',
  company_name: '',
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
  items: [defaultItem],
};
