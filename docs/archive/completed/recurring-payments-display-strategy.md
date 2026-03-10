# Recurring Payments Display Strategy

## Current State (What You Have Today)

| Location | What shows | Recurring-specific? |
|----------|------------|----------------------|
| **`/finance/recurring`** | Pending section (auto-generated, this month) + Active/Inactive templates | Yes. User confirms or edit+confirm here. |
| **`/finance/expenses`** | All expense transactions for selected period (from `financial_transactions`, no `status` filter) | No. Pending recurring rows appear like any other expense; no badge or link to template. |
| **`/finance` dashboard** | KPIs, revenue vs expenses, expense by category, recent transactions | No. No widget for “pending recurring” or “upcoming recurring.” |

**Important:**  
- `fetchTransactions` does **not** filter by `status`, so **pending recurring payments already appear on the Expenses page** — they’re just not labeled.  
- `v_profit_and_loss` does **not** filter expenses by `status`, so **pending recurring expenses are included in P&L** (they reduce “profit” before confirmation). You may want to change this later so only `status = 'confirmed'` counts.

---

## Answers to Your Questions

### 1. Should generated payments appear in the Expenses page immediately?

**Yes.**  
They already do (same table, no status filter). The gap is **discoverability and meaning**: users don’t see that a row is “from recurring” or “pending confirmation.” So:

- Keep showing them on Expenses.
- Add a **recurring indicator** (e.g. badge/icon) and, if useful, a **status** (e.g. “Bekleyen” / “Onaylandı”).
- Optionally add a **filter**: “Tümü / Sadece tekrarlayan / Sadece bekleyen” so users can focus.

### 2. Should they have "pending" status requiring user confirmation?

**Yes, keep the current model.**  
- Cron creates rows with `status = 'pending'`.  
- User confirms (or edit+confirm) on Recurring page (or from Expenses if you add actions there).  
- After confirm → `status = 'confirmed'`.  

This fits a small business: auto-generation saves data entry, but a human still approves before it’s “real.”

### 3. Should the dashboard show a notification/widget for pending recurring payments?

**Yes.**  
Dashboard is the natural place for “things that need attention.” A small widget is enough:

- **“Bekleyen tekrarlayan ödemeler”**: count + total amount (e.g. “5 ödeme, 85.000 ₺”) + link to `/finance/recurring` (or to a filtered Expenses view).  
- Optionally: “Önümüzdeki 7 gün” (upcoming) for awareness, but **pending count is the main metric** for action.

### 4. Should there be a link/connection between the expense record and its source template?

**Yes.**  
- In the Expenses table: show a small “Tekrarlayan” badge (and optionally “Bekleyen”) and, if the row has `recurring_template_id`, a link to the template (e.g. open template in a modal or navigate to `/finance/recurring` with template highlighted).  
- In Recurring: you already show which template generated each pending row.  
- This gives a clear path: **Expense row ↔ Template** in both directions.

### 5. What's the user journey from "template created" → "payment generated" → "payment confirmed/completed"?

Recommended journey:

1. **Template created** at `/finance/recurring` (e.g. “Kira 15.000 ₺, her ayın 5’i”).
2. **Cron runs** (e.g. monthly) and inserts rows into `financial_transactions` with `status = 'pending'`, `recurring_template_id` set.
3. **User sees pending** in at least one of:
   - **Recurring page**: “X bekleyen ödeme — [Ay]” (current behavior).
   - **Dashboard**: “Bekleyen tekrarlayan: 5 ödeme, 85.000 ₺” → link to Recurring or Expenses.
   - **Expenses page**: pending rows with “Tekrarlayan · Bekleyen” badge.
4. **User confirms** (or edits amount/date then confirms):
   - Either on **Recurring** (Tümünü onayla / per row).
   - Or from **Expenses** (e.g. row action “Onayla” for that transaction).
5. **Confirmed** → `status = 'confirmed'`. Row stays in Expenses, now shown as “Onaylandı” or with no “Bekleyen” badge; it’s part of normal expense history and P&L (if you restrict P&L to confirmed only, then it enters P&L at this step).

---

## Recommendation: **Option C (Both)**

Use **Expenses for detail and history**, and **Dashboard for overview and alerts**.

| Place | Role |
|-------|------|
| **`/finance/expenses`** | Show all expenses (including recurring). Add recurring badge + status; optional filter; link to template; optional “Onayla” for pending. |
| **`/finance` dashboard** | Widget: “Bekleyen tekrarlayan ödemeler” (count + total + link). Optionally “Bu ay toplam tekrarlayan” for planning. |
| **`/finance/recurring`** | Keep as **control center**: templates + pending list + confirm/edit. No need to duplicate the full expense list here. |

Why this fits a small business:

- **One source of truth**: All payments (manual + recurring) live in `financial_transactions` and appear on Expenses.  
- **Recurring page** stays the place to manage templates and to **confirm pending** in bulk or one-by-one.  
- **Dashboard** answers “Do I have anything to confirm?” without opening Recurring.  
- **Expenses** answers “What did we pay / what’s pending?” with full filters and a clear link back to the template.

---

## Suggested Implementation Order

1. **Expenses page**  
   - Add column or badge: “Tekrarlayan” (and “Bekleyen” when `status === 'pending'`).  
   - Add link from expense row to template (e.g. by `recurring_template_id`).  
   - Optional: filter “Sadece tekrarlayan” / “Sadece bekleyen”.  
   - Optional: row action “Onayla” for pending recurring (could call same confirm API you use on Recurring).

2. **Dashboard**  
   - New widget: pending recurring count + total amount + “Görüntüle” → `/finance/recurring` (or filtered Expenses).  
   - Use existing `fetchPendingExpenses(currentPeriod)` (or a small variant) so you don’t duplicate logic.

3. **P&L / reporting (optional)**  
   - Decide whether `v_profit_and_loss` should exclude `status = 'pending'` for expenses. If yes, add `AND ft.status = 'confirmed'` (and keep income logic as needed) so pending recurring don’t affect profit until confirmed.

---

## Summary

- **Option C** is the right fit: **Expenses** = full list + recurring badge + link to template; **Dashboard** = pending recurring widget; **Recurring** = templates + confirm flow.  
- Generated payments **should** appear on Expenses (they already do); add **indicators and link to template**.  
- Keep **pending → confirm** flow; surface pending on Dashboard and optionally allow confirm from Expenses.  
- One clear user journey: template → cron creates pending → user sees pending on Dashboard/Recurring/Expenses → confirms → row is “completed” and stays in Expenses with link to template.
