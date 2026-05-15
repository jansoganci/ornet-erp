Fix two things:

## 1. Remove the old "Faturalandır" placeholder button and modal from proposal pages.

The ParasutInvoicePanel is now integrated directly on the proposal detail page, so the old "coming soon" button and modal are no longer needed.

Changes needed:
- In ProposalDetailPage.jsx: Remove `showFaturalandirModal` state, remove `onFaturalandir` prop from ProposalHero, remove the FAB button that opens it, remove the entire "Faturalandır — Yakında Modal" `<Modal>` block.
- In ProposalHero.jsx: Remove the `onFaturalandir` prop from destructuring, remove the "Faturalandır" button that uses `Receipt` icon, remove `Receipt` from imports if no longer used.

## 2. Remove duplicate download buttons in ProposalDetailPage.jsx

Find and fix any duplicate or broken download button in the FAB section.

After all changes, run `npm run build` and verify.
