# Table Layout Alternatives (Section 3.1 Replacement)

**Goal:** Fit 11 columns without horizontal scroll, **keeping full column names**.

**Rejected:** Short headers / abbreviations.

---

## Option A: Two-Row Header (Multi-line Headers)

Split long headers into two lines to reduce horizontal space:

- "Baz Fiyat" → "Baz" (line 1) + "Fiyat" (line 2)
- "SMS Ücreti" → "SMS" (line 1) + "Ücreti" (line 2)
- "Hat Ücreti" → "Hat" (line 1) + "Ücreti" (line 2)
- "Hesap No" → "Hesap" (line 1) + "No" (line 2)
- "Başlangıç" → "Başlangıç" (single line, or "Başlangıç" + "Tarihi")
- "Ödeme Sıklığı" → "Ödeme" (line 1) + "Sıklığı" (line 2)
- "Hizmet Türü" → "Hizmet" (line 1) + "Türü" (line 2)

**Implementation:**
- Modify Table component to support `headerLines` array or `headerComponent` function.
- Or use CSS `writing-mode` / flex column layout in `<th>`.
- Headers become taller but narrower.

**Pros:** Full names visible, saves ~30-40% header width.  
**Cons:** Taller header row, may look cramped.

---

## Option B: Grouped Pricing Columns (Vertical Stack)

Combine all 5 pricing columns (Baz Fiyat, SMS Ücreti, Hat Ücreti, KDV, Maliyet) into **one column** with vertical stack:

```
┌─────────────────┐
│ Baz Fiyat       │
│ [input]         │
│ SMS Ücreti      │
│ [input]         │
│ Hat Ücreti      │
│ [input]         │
│ KDV             │
│ [input]         │
│ Maliyet         │
│ [input]         │
└─────────────────┘
```

**Implementation:**
- Replace 5 columns with 1 "Fiyatlar" column.
- Render function returns a `<div className="space-y-2">` with labels + inputs.
- Header: "Fiyatlar" or "Fiyat Bilgileri".

**Pros:** Reduces 11 → 7 columns, saves significant width.  
**Cons:** Taller rows, less "scan-able" horizontally.

---

## Option C: Compact Padding + Smaller Fonts + Fixed Widths

Aggressive space optimization:

1. **Reduce cell padding:** `px-6 py-4` → `px-3 py-2` (or `px-4 py-3`).
2. **Smaller header font:** `text-xs` → `text-[10px]` or `text-[11px]`.
3. **Smaller body font:** `text-sm` → `text-xs` for non-inputs.
4. **Narrower inputs:** `w-24` → `w-20`, `w-20` → `w-18`, `w-16` → `w-14`.
5. **Fixed column widths** with CSS `table-layout: fixed`:
   - Müşteri: 140px
   - Hesap No: 75px
   - Başlangıç: 85px
   - Tip: 65px
   - Hizmet Türü: 90px
   - Ödeme Sıklığı: 100px
   - Baz Fiyat: 90px
   - SMS Ücreti: 85px
   - Hat Ücreti: 85px
   - KDV: 70px
   - Maliyet: 90px
   - **Total: ~1015px** (fits in 1280px with padding)

**Implementation:**
- Add `table-layout: fixed` to `<table>`.
- Set `width` on each column config.
- Reduce padding/font sizes in PriceRevisionPage (or pass `compact` prop to Table).

**Pros:** Keeps all columns visible, standard table layout.  
**Cons:** Denser, may feel cramped; requires careful width tuning.

---

## Option D: Responsive Column Hiding

Show priority columns always, hide less critical ones on medium screens:

**Always visible (7 columns):**
- Müşteri, Hesap No, Başlangıç, Tip, Baz Fiyat, KDV, Maliyet

**Hidden on `xl` screens, visible on `2xl` (8 columns):**
- Add: SMS Ücreti, Hat Ücreti

**Hidden on `xl` screens, visible on `2xl` (10 columns):**
- Add: Hizmet Türü, Ödeme Sıklığı

**Implementation:**
- Use Tailwind responsive classes: `hidden xl:table-cell` / `hidden 2xl:table-cell`.
- Or conditional column array based on viewport width hook.

**Pros:** Progressive disclosure, fits on smaller screens.  
**Cons:** Some data hidden until larger screen; may frustrate users who need all columns.

---

## Option E: Rotated Headers (45° Angle)

Rotate header text 45 degrees to fit longer names in less width:

```
Müşteri
  ↘
```

**Implementation:**
- CSS `transform: rotate(-45deg)` or `writing-mode` on `<th>`.
- Adjust header height to accommodate rotated text.

**Pros:** Full names visible, saves width.  
**Cons:** Less readable, requires more header height, may look unprofessional.

---

## Option F: Split Table (Two Sections)

Split into two side-by-side tables or sections:

**Left table (6 columns):** Müşteri, Hesap No, Başlangıç, Tip, Hizmet Türü, Ödeme Sıklığı  
**Right table (5 columns):** Baz Fiyat, SMS Ücreti, Hat Ücreti, KDV, Maliyet

**Implementation:**
- Two `<Table>` components side by side with `flex` layout.
- Sync row selection/highlighting.
- Or use CSS Grid with two column groups.

**Pros:** Each table fits easily, clear separation.  
**Cons:** Harder to scan across all columns, sync scrolling needed.

---

## Recommended Combination: Option B (Grouped Pricing) + Option C (Compact)

**Best fit:** Combine Option B (group pricing columns) + Option C (compact padding/fonts).

- **7 columns total:** Müşteri, Hesap No, Başlangıç, Tip, Hizmet Türü, Ödeme Sıklığı, **Fiyatlar** (grouped).
- Compact padding (`px-4 py-3`) and smaller fonts.
- Fixed widths totaling ~850px → fits comfortably in 1280px.

**Result:** All data visible, no horizontal scroll, full column names, still editable.
