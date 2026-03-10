# Proposal PDF — Header Section Compact Layout (Analysis)

**Date:** February 2026  
**Scope:** Header info block only (FİRMA ADI, YETKİLİ KİŞİ, PROJE ADI, etc.)  
**Goal:** Reduce vertical space by ~30–40% while keeping readability and hierarchy.

---

## 1. Current State (ProposalPdf.jsx)

### 1.1 Structure

- **Container:** `headerGrid` — `flexDirection: 'row'`, `flexWrap: 'wrap'`, so items flow in two columns.
- **Cell:** `HeaderField` wraps each label+value in `headerGridHalf` (width 50%).
- **8 fields** in 4 visual rows (2 columns × 4 rows).

### 1.2 Current Styles

| Style            | Property      | Current value | Role |
|------------------|---------------|---------------|------|
| `topRow`         | marginBottom  | **20**        | Space below logos before header |
| `headerGrid`     | marginBottom  | **16**        | Space below header block |
| `headerGridHalf` | marginBottom  | **6**         | Space below each row (each half) |
| `headerGridLabel`| fontSize      | **9**         | Label (e.g. "FİRMA ADI :") |
| `headerGridLabel`| marginBottom  | **1**         | Gap between label and value |
| `headerGridValue`| fontSize      | **10**        | Value text |

No explicit `lineHeight` or `paddingVertical` — so react-pdf uses default line height (~1.2× fontSize), which adds extra vertical space.

### 1.3 Where the Vertical Space Comes From

- **Per row (2 cells):** label (~9pt + 1pt margin) + value (~10pt) + cell `marginBottom: 6` → ~26–28pt per row.
- **4 rows:** ~104–112pt content + 16pt `headerGrid.marginBottom` → **~120–128pt** for the header block.
- **topRow.marginBottom: 20** adds another 20pt above the header.
- **Total header area (below logos):** ~140–148pt (~49–52mm on A4).

So the main levers are: row spacing (`headerGridHalf.marginBottom`), block margins (`headerGrid.marginBottom`, `topRow.marginBottom`), and line height / label–value gap.

---

## 2. Goal

- **~30–40% less vertical space** for the same 8 fields.
- Still **clean, minimal, professional**.
- **Clear hierarchy:** labels vs values.
- **Readable** at normal print/PDF zoom.

---

## 3. Suggested Style Changes (Specific Values)

### 3.1 Reduce Row and Block Margins

| Style            | Property     | Current | Suggested | Saving (approx.) |
|------------------|-------------|---------|-----------|-------------------|
| `topRow`         | marginBottom| 20      | **12**    | 8pt               |
| `headerGrid`     | marginBottom| 16      | **10**    | 6pt               |
| `headerGridHalf` | marginBottom| 6       | **2**     | 16pt (4×4pt)      |

These three changes alone save **~30pt** and bring the block height down by ~25%.

### 3.2 Tighten Label and Value (Optional but Recommended)

| Style             | Property     | Current | Suggested | Note |
|-------------------|-------------|---------|-----------|------|
| `headerGridLabel` | marginBottom| 1       | **0**     | Minimal gap; still clear if value uses lineHeight |
| `headerGridLabel` | lineHeight  | (none)  | **1.1**   | Slightly tighter label block |
| `headerGridValue` | lineHeight  | (none)  | **1.15**  | Slightly tighter value block |

Keeping **fontSize 9 / 10** avoids sacrificing readability; only spacing and line height are reduced.

### 3.3 Optional: Slightly Smaller Fonts (If You Want to Push ~40% Reduction)

| Style             | Property | Current | Alternative |
|-------------------|----------|---------|-------------|
| `headerGridLabel` | fontSize | 9       | **8**       |
| `headerGridValue` | fontSize | 10      | **9**       |

Use only if the compact margins + line height are not enough; test in PDF to ensure small print is still acceptable.

---

## 4. Expected Result (Rough)

- **Current:** ~140–148pt for logo margin + header block.
- **After (margins + line height):** ~100–110pt → **~30% reduction**.
- **After (+ smaller fonts):** ~90–100pt → **~35–40% reduction**.

Readability and hierarchy stay good because:
- Label vs value contrast is unchanged (color, weight).
- Font sizes stay 9/10 unless you opt into 8/9.
- Less “air” between rows, but rows remain separated.

---

## 5. Wireframe — Current vs Proposed

### 5.1 Current (conceptual)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [LOGO]                                                    [CERT]       │
│                                                                         │
│  ← marginBottom: 20                                                     │
│                                                                         │
│  FİRMA ADI :                    KEŞİF TARİHİ :                          │
│  Acme Ltd.                      15 Ocak 2026                            │
│  ← marginBottom: 6                                                      │
│  YETKİLİ KİŞİ :                 TEKLİF TARİHİ :                         │
│  Ahmet Yılmaz                   10 Şubat 2026                          │
│  ← marginBottom: 6                                                      │
│  PROJE ADI :                    MONTAJ TARİHİ :                         │
│  Güvenlik Kamera Sistemi        —                                       │
│  ← marginBottom: 6                                                      │
│  MÜŞTERİ TEMSİLCİSİ :          BİTİŞ TARİHİ :                           │
│  Mehmet Kaya                    —                                       │
│  ← marginBottom: 6                                                      │
│  ← headerGrid marginBottom: 16                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Proposed (compact)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [LOGO]                                                    [CERT]       │
│  ← marginBottom: 12 (was 20)                                            │
│  FİRMA ADI :                  KEŞİF TARİHİ :                            │
│  Acme Ltd.                    15 Ocak 2026                              │
│  ← marginBottom: 2 (was 6)                                              │
│  YETKİLİ KİŞİ :               TEKLİF TARİHİ :                           │
│  Ahmet Yılmaz                 10 Şubat 2026                            │
│  ← marginBottom: 2                                                      │
│  PROJE ADI :                  MONTAJ TARİHİ :                           │
│  Güvenlik Kamera Sistemi      —                                         │
│  ← marginBottom: 2                                                      │
│  MÜŞTERİ TEMSİLCİSİ :        BİTİŞ TARİHİ :                             │
│  Mehmet Kaya                  —                                         │
│  ← headerGrid marginBottom: 10 (was 16)                                │
└─────────────────────────────────────────────────────────────────────────┘
```

Same 2-column, 4-row layout; only spacing is reduced so the block uses less vertical space.

---

## 6. Summary Table (Copy-Paste Friendly)

| Style             | Property     | Current | Suggested |
|-------------------|-------------|---------|-----------|
| `topRow`          | marginBottom| 20      | 12        |
| `headerGrid`      | marginBottom| 16      | 10        |
| `headerGridHalf`  | marginBottom| 6       | 2         |
| `headerGridLabel` | marginBottom| 1       | 0         |
| `headerGridLabel` | lineHeight  | —       | 1.1       |
| `headerGridValue` | lineHeight  | —       | 1.15      |

Optional (for ~40% reduction):

| `headerGridLabel` | fontSize | 9  | 8 |
| `headerGridValue` | fontSize | 10 | 9 |

---

## 7. Implementation Note

All of the above are changes only in `StyleSheet.create({ ... })` and optionally in the `HeaderField` usage (no structural change). No new components or layout logic required.
