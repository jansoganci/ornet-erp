# Move discount section into Kalemler card – Plan

## Answers to your questions

1. **Does discount_percent already exist in proposals table?**  
   **Yes.** It was added in `00029_proposal_cost_terms_logo.sql` (`ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2)`). The `proposals_detail` view also exposes it.

2. **Which component handles the "Kalemler" section?**  
   **ProposalItemsEditor.jsx** – it renders the items table and the current single "Grand Total" row at the bottom.

3. **Where is the current discount input?**  
   **ProposalFormPage.jsx** lines 235–244, inside the "Logo ve PDF Başlık Bilgileri" card:
   ```jsx
   <Input
     label={t('proposals:form.fields.discountPercent')}
     type="number"
     min={0}
     max={100}
     step={0.01}
     placeholder="0"
     error={errors.discount_percent?.message}
     {...register('discount_percent')}
   />
   ```

4. **Do we need any database changes?**  
   **No.** Only UI reorganization: move the discount input and add the totals block (Ara Toplam, İskonto Oranı, İskonto Tutarı, TOPLAM) inside the Kalemler card.

5. **How should this affect TOPLAM on ProposalDetailPage?**  
   **No change.** Detail page already computes:
   - `subtotal` = sum of item line totals  
   - `discountAmount` = subtotal × (discount_percent / 100)  
   - `grandTotal` = subtotal − discountAmount  
   and shows Subtotal / Discount % / Discount amount when discount > 0, then TOPLAM. The form will use the same logic so saved proposals already display correctly.

---

## Target layout (inside Kalemler card)

- [Item rows...]
- **Ara Toplam:** $X.XX  
- **İskonto Oranı (%):** [input]  
- **İskonto Tutarı:** -$X.XX (calculated, show only when percent > 0)  
- ─────────────────────  
- **TOPLAM:** $X.XX  

Calculation (same as detail/PDF):

- **Ara Toplam** = sum of (quantity × unit_price_usd) for all items  
- **İskonto Tutarı** = Ara Toplam × (discount_percent / 100)  
- **TOPLAM** = Ara Toplam − İskonto Tutarı  

---

## Implementation steps

| Step | File | Action |
|------|------|--------|
| 1 | **ProposalFormPage.jsx** | Remove the discount `Input` (and its wrapping div if any) from the "Logo ve PDF Başlık Bilgileri" card (lines 235–244). |
| 2 | **ProposalItemsEditor.jsx** | Add the totals block above the current "Grand Total" row: Ara Toplam row, İskonto Oranı (%) input, optional İskonto Tutarı row, divider, then TOPLAM row. Use `watch('discount_percent')`, existing `register`/`errors` from props; compute subtotal (current `grandTotal`), discount amount, and grand total. Import `Input` from `@/components/ui` if not present. |
| 3 | **locales (proposals.json)** | Add `detail.discountAmount`: `"İskonto Tutarı"` for the discount amount row label (used in form and detail). |
| 4 | **ProposalDetailPage.jsx** | Optional: use the new `detail.discountAmount` key for the discount line label so it says "İskonto Tutarı" instead of "İskonto %X" for the line that shows the amount. (Current: "İskonto %{{percent}}" and "-$X". We can keep that or add a second line label; plan uses "İskonto Tutarı" for the amount line.) |

No API or DB changes. No change to ProposalPdf or detail page logic beyond optional label.
