

# Proposal Currency Safety Open Issues

## Status

This is an open issue document. Do not implement changes from this file directly.

The topic is separate from the proposal/work-order labor finance refactor, but it affects the accuracy of proposal revenue, material cost, and future internal reporting.

## Context

All materials are currently priced in USD.

USD proposals are structurally safer today because material prices are already USD. TRY proposals are riskier because USD material values may be copied into TRY proposal rows without explicit FX conversion.

## Current Verified Behavior

1. When a TRY proposal created on day C is edited on day Y, the edit form shows the stored TRY values.
2. The form does not automatically re-convert old rows using the latest FX rate.
3. If the user manually edits a TRY line from 150 TRY to 160 TRY, the DB stores 160 TRY.
4. USD values are not recalculated from the manually edited TRY value.
5. Proposal line FX rate is not cu  rrently stored.
6. Material selection returns the material price and material currency, but the proposal item editor currently ignores the material currency.
7. If a USD-priced material is selected into a TRY proposal, there is a risk that the USD number is copied as TRY without conversion.
8. Changing proposal currency after lines exist does not safely convert existing rows.

## Decisions Already Made

1. Editing an existing TRY proposal should show frozen stored TRY values.
2. Existing TRY proposal lines should not automatically refresh to the latest FX rate when opened.
3. Manual TRY edits should overwrite TRY fields only.
4. Refreshing prices with latest FX must be explicit and manual.
5. Currency changes after proposal lines exist should be blocked or require an explicit conversion/migration dialog with preview.
6. This issue should not block the current labor/finance model decisions, but it should be treated as a prerequisite/risk before deeper proposal revenue classification work.

## Open Questions

1. Which FX rate should be used when converting USD materials into TRY proposal lines?
2. Should the FX rate be stored at proposal level, line level, or both?
3. Should the original USD source amount be stored for TRY proposal lines?
4. Should the system store `fx_rate_used` for each converted line?
5. Should the system store a `conversion_source` such as `material`, `manual`, or `repriced`?
6. Should TRY proposal lines support a manual “refresh with latest FX rate” action?
7. Should changing proposal currency after lines exist be fully blocked?
8. If currency change is allowed, what should the confirmation and preview flow look like?
9. Should material selection into TRY proposals convert automatically, or should it ask for confirmation?
10. How should revised TRY proposals handle old frozen prices versus new material selections?

## Recommended Future Direction

Prefer a safe, explicit model:

1. Proposal currency should be selected before entering lines.
2. If lines exist, changing currency should be blocked or require an explicit preview and confirmation.
3. Selecting a USD material into a TRY proposal should convert using a known FX rate.
4. The displayed TRY amount should be stored as the proposal line value.
5. The original USD source amount and FX rate used should be stored for auditability if feasible.
6. Old TRY proposal rows should remain frozen unless the user explicitly chooses to refresh prices.
7. “Refresh with latest FX” should be a manual action, never automatic on edit/open.

## Files Previously Inspected

- `src/features/proposals/ProposalFormPage.jsx`
- `src/features/proposals/components/ProposalItemsEditor.jsx`
- `src/components/ui/MaterialCombobox.jsx`
- `src/features/proposals/api.js`
- `src/lib/proposalCalc.js`
- `src/features/proposals/components/ProposalCompletionRateModal.jsx`
- `src/features/proposals/ProposalDetailPage.jsx`
- `supabase/migrations/00237_fix_proposal_integrity_and_transaction.sql`
- `supabase/migrations/00236_fix_proposal_completion_exchange_rate.sql`
- `supabase/migrations/00131_proposal_items_currency_enforcement.sql`

## Not In Scope For Current Labor/Finance Refactor

1. Do not solve this inside the labor/finance refactor unless explicitly approved.
2. Do not change historical proposal records automatically.
3. Do not auto-reprice old TRY proposals.
4. Do not silently convert or reinterpret old numeric values.
5. Do not change customer-facing proposal PDFs as part of this note.