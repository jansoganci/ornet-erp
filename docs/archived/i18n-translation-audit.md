# i18n Translation Completeness Audit

**Date:** 2026-02-03  
**Scope:** All `t()`, `tCommon()`, `i18n.t()` usage in `src/` vs `src/locales/tr/*.json`

---

## 1. Missing keys (used in code, not in JSON)

| Key | Where used | Priority |
|-----|------------|----------|
| `common:actions.menu` | `AppLayout.jsx:30` (aria-label for mobile menu) | **Critical** – shows key/undefined |
| `errors:validation.required` | `customers/schema.js:8,12`, `workOrders/schema.js:6,7`, `tasks/schema.js:6` | **Critical** – validation messages |
| `errors:validation.maxLength` | `customers/schema.js:9` (with `{ max: 100 }`) | **Critical** |
| `errors:validation.phone` | `customers/schema.js:13,16` | **Critical** |
| `errors:validation.email` | `customers/schema.js:21` | **Critical** |
| `errors:workOrder.notFound` | `workOrders/api.js:190,204,213` | **Critical** – thrown in errors |
| `errors:customer.notFound` | `customers/api.js:42,57,67` | **Critical** – thrown in errors |
| `workOrders:statuses.in_progress` | `WorkOrdersListPage.jsx:75` (`t('statuses.in_progress')` – API uses snake_case) | **Critical** – list shows key |
| `workOrders:form.customerSelect.noResults` | `CustomerSelect.jsx:80` | **Critical** |
| `workOrders:form.customerSelect.addNew` | `CustomerSelect.jsx:87,119` | **Critical** |
| `workOrders:list.columns.customer` | `WorkOrdersListPage.jsx:88` (fallback: `detail.customer`) | Warning |
| `workOrders:list.columns.title` | `WorkOrdersListPage.jsx:104` (fallback: `form.fields.title`) | Warning |
| `workOrders:list.columns.type` | `WorkOrdersListPage.jsx:108` (fallback: `detail.fields.type`) | Warning |
| `workOrders:list.columns.status` | `WorkOrdersListPage.jsx:117` (fallback: `detail.fields.status`) | Warning |
| `workOrders:list.columns.priority` | `WorkOrdersListPage.jsx:126` (fallback: `detail.fields.priority`) | Warning |
| `workOrders:list.columns.scheduledDate` | `WorkOrdersListPage.jsx:135`, `CustomerDetailPage.jsx:147` (fallback) | Warning |
| `workOrders:detail.fields.customer` | `WorkOrderDetailPage.jsx:197` (fallback: `detail.customer`) | Warning |
| `workOrders:detail.fields.phone` | `WorkOrderDetailPage.jsx:210` (fallback: common `labels.phone`) | Warning |
| `workOrders:detail.fields.address` | `WorkOrderDetailPage.jsx:218` (fallback: common `labels.address`) | Warning |
| `workOrders:detail.statusModal.title` | `WorkOrderDetailPage.jsx:344` (fallback: common `labels.statusUpdate`) | Warning |

---

## 2. Incomplete translations (TR vs EN)

- **EN locale does not exist.** Only `src/locales/tr/` is present; `src/locales/en/` is missing.
- i18n is configured with `lng: 'tr'`, `fallbackLng: 'tr'`, and only `resources.tr` in `src/lib/i18n.js`.
- **Action:** To support English, add `src/locales/en/` with the same namespace files and wire `resources.en` in i18n.

---

## 3. Data issues in TR JSON

| File | Issue |
|------|--------|
| `common.json` | Duplicate key `"success"`: first as object `{ "saved", "created", ... }`, then as string `"Başarılı"`. Parser keeps the string; `common:success.saved` etc. are lost. |
| `common.json` | Root `"confirm"` object (`title`, `deleteMessage`, `yes`, `no`) coexists with `actions.confirm`; no conflict but be consistent. |

---

## 4. Empty / placeholder values

- No empty string values (`""`) or TODO/FIXME/TBD found in `src/locales/tr/*.json`.

---

## 5. Proposed TR (and EN) values for missing keys

### common (TR)

- `actions.menu`: **TR** "Menü" · **EN** "Menu"

### errors (TR)

- `validation.required`: **TR** "Bu alan zorunludur" · **EN** "This field is required"
- `validation.maxLength`: **TR** "En fazla {{max}} karakter olabilir" · **EN** "At most {{max}} characters"
- `validation.phone`: **TR** "Geçerli bir telefon numarası girin" · **EN** "Enter a valid phone number"
- `validation.email`: **TR** "Geçerli bir e-posta girin" · **EN** "Enter a valid email"
- `workOrder.notFound`: **TR** "İş emri bulunamadı." · **EN** "Work order not found."
- `customer.notFound`: **TR** "Müşteri bulunamadı." · **EN** "Customer not found."

### workOrders (TR)

- `statuses.in_progress`: **TR** "Devam Ediyor" · **EN** "In progress" (same as existing `inProgress`; needed for API snake_case)
- `form.customerSelect.noResults`: **TR** "Müşteri bulunamadı" · **EN** "No customers found"
- `form.customerSelect.addNew`: **TR** "Yeni müşteri ekle" · **EN** "Add new customer"
- `list.columns.customer`: **TR** "Müşteri" · **EN** "Customer"
- `list.columns.title`: **TR** "Başlık" · **EN** "Title"
- `list.columns.type`: **TR** "Tip" · **EN** "Type"
- `list.columns.status`: **TR** "Durum" · **EN** "Status"
- `list.columns.priority`: **TR** "Öncelik" · **EN** "Priority"
- `list.columns.scheduledDate`: **TR** "Planlanan Tarih" · **EN** "Scheduled date"
- `detail.fields.customer`: **TR** "Müşteri" · **EN** "Customer"
- `detail.fields.phone`: **TR** "Telefon" · **EN** "Phone"
- `detail.fields.address`: **TR** "Adres" · **EN** "Address"
- `detail.statusModal.title`: **TR** "Durum Güncelle" · **EN** "Update status"

---

## 6. Fix summary

1. **Critical:** Add missing keys to `common.json`, `errors.json`, and `workOrders.json` (TR) as in section 5.
2. **common.json:** Fix duplicate `success` (e.g. rename root string to `successLabel` or keep only the object).
3. **Optional:** Add `workOrders:list.columns` and `detail.fields`/`detail.statusModal` for consistency even though fallbacks exist.
4. **EN:** Add `src/locales/en/` and register in i18n when English is required.
