# i18n Missing Translations Audit

**Date:** 2025-02-05  
**Method:** Code scan (grep for `t(`, `tCommon(`, `i18n.t(`) + cross-check with `src/locales/tr/*.json`.

---

## MISSING KEYS

### common.json
- **fields.amount** — Used in WorkOrderFormPage, WorkOrderDetailPage, MaterialSelector (label for amount field).
- **fields.notes** — Used in SiteFormModal, CustomerFormPage, WorkOrderDetailPage (material column), MaterialSelector.
- **labels.records** — Used in DailyWorkListPage (e.g. "X kayıt").
- **labels.areYouSure** — Used in MaterialsListPage delete modal title.
- **deleteConfirm** — Used in MaterialsListPage delete modal body (e.g. "… silinsin mi?").
- **noResults** — Used in WorkHistoryPage, MaterialsListPage, CustomerSiteSelector; file only has `empty.noResults`.
- **placeholders.notes** — Used in CustomerFormPage; file has `placeholders.noNotes` only.
- **status.in_progress** — API uses `in_progress`; file has `status.inProgress` only (WorkOrdersListPage, DailyWorkCard, WorkOrderDetailPage use `status.${value}`).
- **actions.view** — Used in DailyWorkCard ("Detayları Gör" link); file has `actions.viewDetails` only.
- **roles.field_worker** — Used in WorkerSelector for profile role label; no `roles` object in common.

### customers.json
- **detail.notFound** — Used in CustomerDetailPage when customer fetch fails.
- **sites.editButton** — Used in SiteFormModal title when editing; only `sites.addButton` exists.
- **form.fields.companyName** — Used in CustomerFormPage; file has `form.fields.name` only.
- **form.placeholders.companyName** — Used in CustomerFormPage; file has `form.placeholders.name` only.
- **form.fields.taxNumber** — Used in CustomerFormPage; not present.
- **form.placeholders.taxNumber** — Used in CustomerFormPage; not present.

### workOrders.json
- **form.fields.quantity** — Used in MaterialSelector placeholder, WorkOrderDetailPage materials table column.
- **form.fields.title** — Used in EventDetailModal (calendar) for work order title.
- **form.placeholders.searchCustomer** — Used in CustomerSelect and CustomerSiteSelector; file has `form.placeholders.selectCustomer` only.
- **form.fields.selectCustomer** — Used in CustomerSiteSelector as label; file has `form.fields.customer` only.
- **form.fields.selectSite** — Used in CustomerSiteSelector as label; file has `form.fields.site` only.
- **detail.siteInfo** — Used in WorkOrderDetailPage card header.
- **detail.companyInfo** — Used in WorkOrderDetailPage card label.
- **detail.materialsUsed** — Used in WorkOrderDetailPage materials card header; file has `detail.fields.materials` only.
- **list.filters.workType** — Used as Select placeholder in WorkOrdersListPage (for status filter); file has `list.filters.type`, `typePlaceholder`, `statusPlaceholder` only.

### dashboard.json
- **quickActions.dailyWork** — Used in DashboardPage (code has fallback "Günlük İşler").
- **quickActions.workHistory** — Used in DashboardPage (code has fallback "İş Geçmişi Ara").

### errors.json
- **auth.supabaseNotConfigured** — Used in LoginPage when Supabase is not configured; string exists in `auth.json` under `errors.supabaseNotConfigured`, but `errors` namespace needs `auth.supabaseNotConfigured`.
- **invalid** — Used in LoginPage catch block as generic error message.

---

## Keys that exist but are used with different key path

- **common:empty.noResults** — Code sometimes uses `tCommon('noResults')`; consider adding `noResults` that mirrors `empty.noResults` or updating calls to `empty.noResults`.
- **common:actions.viewDetails** — Code in DailyWorkCard uses `actions.view`; either add `actions.view` or change code to `actions.viewDetails`.
- **common:status.inProgress** — Code uses `status.${workOrder.status}` where API returns `in_progress`; add `status.in_progress` with same value as `inProgress`, or normalize in code.

---

## Optional: Runtime check

To catch any remaining keys at runtime, add this temporarily in `src/lib/i18n.js`:

```js
i18n.on('missingKey', (lngs, namespace, key, res) => {
  console.error('🔴 MISSING i18n KEY:', { namespace, key });
});
```

Then open every page (Dashboard, Customers list/detail/form, Work Orders list/detail/new, Daily Work, Work History, Materials, Calendar, Tasks, Login) and collect console output.

---

## Summary by file

| File           | Missing count |
|----------------|---------------|
| common.json    | 10            |
| customers.json | 6             |
| workOrders.json| 9             |
| dashboard.json | 2             |
| errors.json    | 2             |

**Total missing keys: 29**

---

## Günlük İşler (Daily Work) page — i18n keys

The Daily Work page uses the **dailyWork** namespace. All strings are in [src/locales/tr/dailyWork.json](src/locales/tr/dailyWork.json).

**Fix applied:** The `dailyWork` namespace was not registered in [src/lib/i18n.js](src/lib/i18n.js), so keys showed as raw text. It is now imported and added to `ns` and `resources.tr`.

| Usage in UI | i18n key (full) | Key in dailyWork.json | Turkish value |
|-------------|-----------------|------------------------|---------------|
| Page title (breadcrumb + heading) | `dailyWork:title` | `title` | Günlük İş Listesi |
| Page subtitle (below title) | `dailyWork:subtitle` | `subtitle` | {{date}} tarihindeki işler |
| Date filter label | `dailyWork:filters.date` | `filters.date` | Tarih Seçin |
| Worker filter label | `dailyWork:filters.worker` | `filters.worker` | Personel Filtresi |
| Worker dropdown “All” option | `dailyWork:filters.allWorkers` | `filters.allWorkers` | Tüm Personeller |
| “Today” button | `dailyWork:today` | `today` | Bugün |
| “Tomorrow” button | `dailyWork:tomorrow` | `tomorrow` | Yarın |
| Reset button | `common:actions.reset` | — | common.json |
| Table section label | `dailyWork:table.workType` | `table.workType` | İş Tipi |
| Record count badge | `common:labels.records` | — | common.json |
| Empty state title | `dailyWork:empty.title` | `empty.title` | Bugün için iş yok |
| Empty state description | `dailyWork:empty.description` | `empty.description` | Seçili tarihte planlanmış bir iş emri bulunamadı. |
| Empty state action button | `workOrders:list.addButton` | — | workOrders.json |
| Loading text | `common:loading` | — | common.json |
