# Action Board — Implementation Plan

**Feature name (internal):** `actionBoard`
**Route:** `/action-board`
**Nav label:** "Aksiyon Listesi"
**Visibility:** Admin only (role check in page, nav item hidden for others)
**DB migrations required:** None — all data already exists.

---

## What This Page Shows

Three independent sections, each loaded in parallel. All expand by default.

---

### Section 1 — Gecikmiş İş Emirleri (Late Work Orders)

**Query logic:**
```
work_orders_detail
WHERE scheduled_date < TODAY
AND   status NOT IN ('completed', 'cancelled')
ORDER BY scheduled_date ASC  ← oldest first (worst at top)
```

**Columns shown per row:**
| Field | Source |
|-------|--------|
| Customer name | `company_name` |
| Site name | `site_name` |
| Work type | `work_type` |
| Scheduled date | `scheduled_date` |
| Days late | computed: `today - scheduled_date` |

**Action button:** "Düzenle →" → navigates to `/work-orders/{id}/edit`

---

### Section 2 — 30+ Gün Ödemesiz Aboneler (Overdue Payments)

**Query logic:**
```
subscription_payments
WHERE status        = 'pending'
AND   payment_month < TODAY - 30 days
ORDER BY payment_month ASC  ← oldest first
```

**Joined data needed:** subscription → site → customer (for company name)

**Columns shown per row:**
| Field | Source |
|-------|--------|
| Customer name | via join |
| Site name | via join |
| Payment month | `payment_month` |
| Days overdue | computed: `today - payment_month` |
| Amount due | `amount` |

**Action button:** "Aboneliğe Git →" → navigates to `/subscriptions/{subscription_id}`

---

### Section 3 — İş Emri Bekleyen Teklifler (Accepted Proposals, No WO)

**Query logic:**
```
proposals_detail
WHERE status          = 'accepted'
AND   work_order_count = 0
ORDER BY created_at ASC  ← oldest first
```

**Columns shown per row:**
| Field | Source |
|-------|--------|
| Customer name | `customer_company_name` |
| Proposal no | `proposal_no` |
| Title | `title` |
| Accepted date | `created_at` |

**Action button:** "İş Emri Oluştur →" → navigates to `/proposals/{id}`
*(Proposal detail page already has the "Create Work Order" flow)*

---

## File Plan

### New Files (3)

| File | Purpose |
|------|---------|
| `src/features/actionBoard/ActionBoardPage.jsx` | The page — three sections |
| `src/features/actionBoard/api.js` | Three fetch functions |
| `src/features/actionBoard/hooks.js` | Three React Query hooks |
| `src/features/actionBoard/index.js` | Barrel export |
| `src/locales/tr/actionBoard.json` | All Turkish strings |

### Modified Files (4)

| File | Change |
|------|--------|
| `src/App.jsx` | Add `/action-board` route |
| `src/components/layout/navItems.js` | Add nav item (top-level, admin only) |
| `src/lib/i18n.js` | Register `actionBoard` namespace |

---

## API Functions (`api.js`)

```js
fetchLateWorkOrders()
// → work_orders_detail, scheduled_date < today, status not completed/cancelled

fetchOverduePayments()
// → subscription_payments + subscription + site + customer
// → status=pending, payment_month < 30 days ago

fetchAcceptedProposalsWithoutWO()
// → proposals_detail, status=accepted, work_order_count=0
```

All three are called in parallel via `Promise.all` — page load is bounded by the slowest query, not the sum of all three.

---

## React Query Hooks (`hooks.js`)

```js
useActionBoardData()
// Single hook that fires all three queries in parallel
// Returns: { lateWorkOrders, overduePayments, pendingProposals, isLoading, errors }
```

---

## Page Layout (`ActionBoardPage.jsx`)

```
PageHeader: "Aksiyon Listesi"

[Section: Gecikmiş İş Emirleri]     ← red badge with count
  row | row | row ...

[Section: 30+ Gün Ödemesiz]         ← red badge with count
  row | row | row ...

[Section: İş Emri Bekleyen Teklifler] ← yellow badge with count
  row | row | row ...

Footer: "Tüm listeler gerçek zamanlı olarak hesaplanmaktadır."
```

If a section has zero items → show a small green "Temiz ✓" state instead of a table. No rows to act on = good news.

---

## Translation Keys (`actionBoard.json`)

```json
{
  "title": "Aksiyon Listesi",
  "sections": {
    "lateWorkOrders": {
      "title": "Gecikmiş İş Emirleri",
      "empty": "Gecikmiş iş emri bulunmuyor."
    },
    "overduePayments": {
      "title": "30+ Gün Ödemesiz Aboneler",
      "empty": "Gecikmiş ödeme bulunmuyor."
    },
    "pendingProposals": {
      "title": "İş Emri Bekleyen Teklifler",
      "empty": "Bekleyen teklif bulunmuyor."
    }
  },
  "columns": {
    "customer": "Müşteri",
    "site": "Lokasyon",
    "workType": "İş Türü",
    "scheduledDate": "Planlanan Tarih",
    "daysLate": "{{count}} gün gecikmiş",
    "paymentMonth": "Ödeme Ayı",
    "daysOverdue": "{{count}} gündür ödenmedi",
    "amountDue": "Tutar",
    "proposalNo": "Teklif No",
    "proposalTitle": "Başlık"
  },
  "actions": {
    "editWorkOrder": "Düzenle",
    "goToSubscription": "Aboneliğe Git",
    "createWorkOrder": "İş Emri Oluştur"
  },
  "allClear": "Temiz",
  "realtimeNote": "Tüm listeler gerçek zamanlı olarak hesaplanmaktadır."
}
```

---

## What's NOT in This Plan (Intentionally)

- No health scores
- No Critical/Warning classification
- No color-coded rows (sections themselves are the grouping)
- No DB materialization or caching
- No complex RPC functions
- No role-based data filtering beyond admin gate

---

## Checklist Before Execution

- [x] Data sources confirmed — no migrations needed
- [x] All three queries are simple and use existing optimized views
- [x] `proposals_detail.work_order_count` already computed in view
- [x] Navigation targets all exist (`/work-orders/{id}/edit`, `/subscriptions/{id}`, `/proposals/{id}`)
- [x] Three queries fired in parallel — fast page load
- [x] Admin-only gate at page level

---

**Status: Awaiting APPROVED to begin execution.**
