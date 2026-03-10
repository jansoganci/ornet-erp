# Simplify cost tracking: one total cost field per item

## Answers

### 1. proposal_items table – cost columns

**Yes.** There are **6** cost-related columns:

- **cost_usd** (DECIMAL) – from `00027_proposals.sql`, single total cost per unit.
- **product_cost_usd, labor_cost_usd, shipping_cost_usd, material_cost_usd, misc_cost_usd** – from `00029_proposal_cost_terms_logo.sql`.

So: 1 single + 5 breakdown columns.

### 2. Keep 5 columns or remove?

**Recommendation: keep all 5 columns in DB, use only cost_usd in the app.**

- **No migration.** We only change the UI and how we *read* total cost.
- **Write:** The single "Maliyet" input is bound to **cost_usd** (per-unit total). On save we keep sending the 5 as `null` (form no longer fills them).
- **Read:** For total cost we use **cost_usd × quantity** per item. For **backwards compatibility**: if `cost_usd` is null (old rows that only have the 5 filled), use (product + labor + shipping + material + misc) × qty.
- Optional later: migration to `UPDATE proposal_items SET cost_usd = COALESCE(cost_usd, product_cost_usd + ... + misc_cost_usd)` and then drop the 5 columns. Not required for this task.

### 3. Which component shows cost fields?

**ProposalItemsEditor.jsx** – both desktop (table row cost section) and mobile (card cost section).

### 4. Current code for cost input

**Desktop (inside each item row):** Lines 417–430:

```jsx
{/* Cost tracking (expanded by default, internal only) */}
<div className="py-2 px-1 bg-neutral-50 dark:bg-[#1a1a1a] rounded-b border-t ...">
  <p className="text-[10px] font-semibold ...">{t('items.costTracking')}</p>
  <div className="grid grid-cols-5 gap-2">
    {costInput('product_cost_usd', 'items.costProduct')}
    {costInput('labor_cost_usd', 'items.costLabor')}
    ...
  </div>
</div>
```

**costInput helper:** Lines 282–312 – renders a label + Controller input for each of the 5 fields.

**Mobile:** Lines 578–618 – similar block with 5 Controller inputs in a grid.

**Default item (append):** Lines 219–225 – sets `cost_usd` and the 5 cost fields to `null`.

**ProposalDetailPage totalCosts:** Lines 103–111 – `sum += (product + labor + shipping + material + misc) * qty` per item.

---

## Plan

| Area | Action |
|------|--------|
| **DB** | No migration. Keep all columns. Use **cost_usd** as the only field we edit; total cost = cost_usd × qty, with fallback to sum(5)×qty when cost_usd is null. |
| **Field to use** | **cost_usd** – per-unit total cost (same as current 5 combined per unit). |
| **ProposalItemsEditor** | Replace the 5 cost inputs with **one** "Maliyet" input bound to `cost_usd` in both desktop and mobile. Remove or simplify the `costInput` helper to a single cost_usd input. Keep the "Maliyet Takibi (dahili)" section title. |
| **ProposalDetailPage** | **totalCosts:** per item use `(Number(item.cost_usd) ?? (product + labor + shipping + material + misc)) * qty` so we prefer cost_usd and fall back to the 5 for old data. |
| **Schema** | Keep `cost_usd` and the 5 optional fields (so API/DB stay compatible). Default item keeps all 6; form only shows cost_usd. |
| **API** | No change – still send cost_usd and the 5 (form will send 5 as null). |
| **ProposalFormPage** | When mapping proposal to form, keep mapping cost_usd and the 5 (for edit load). |
| **i18n** | Add **items.cost**: "Maliyet" for the single field label. |

---

## Summary

- **Database:** No change. Use **cost_usd** only in UI; keep 5 columns for backwards compatibility.
- **UI:** One "Maliyet" input per item in ProposalItemsEditor (desktop + mobile), bound to **cost_usd**.
- **Detail total cost:** Prefer **cost_usd × qty**, fallback to sum(5)×qty when cost_usd is null.
