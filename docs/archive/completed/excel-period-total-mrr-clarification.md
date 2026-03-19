# Clarification: Excel Stores Period Totals, Not Monthly — MRR Calculation

---

## What I Said (Correct Understanding)

My Excel stores **period totals**, not monthly amounts:

| Billing frequency | What I enter in Excel (TL) | Meaning |
|-------------------|----------------------------|---------|
| Monthly (1)       | e.g. 200                   | 200 TL per month |
| 3-month           | 600                        | 600 TL total for 3 months |
| 6-month           | 1200                       | 1200 TL total for 6 months |
| 12-month (yearly) | 2400                       | 2400 TL total for 12 months |

So for yearly, I write 2400 (the full year amount), not 200 (monthly).

---

## What I Need

**MRR (Monthly Recurring Revenue):** I want to calculate monthly equivalent from these totals.

- Yearly 2400 → MRR = 2400 / 12 = 200 TL/month  
- 6-month 1200 → MRR = 1200 / 6 = 200 TL/month  
- 3-month 600 → MRR = 600 / 3 = 200 TL/month  

---

## My Question

**Can I do this with the current system where `billing_frequency` is TEXT?**

Example: I have `base_price = 2400` and `billing_frequency = 'yearly'`. Can I compute MRR as `2400 / 12` in SQL or in the app? Do I need a CASE/divisor mapping like:

```sql
CASE billing_frequency
  WHEN 'yearly'  THEN 12
  WHEN '6_month' THEN 6
  WHEN '3_month' THEN 3
  ELSE 1
END
```

Or is there something that prevents this?

---

## Important: Storage vs. Display

I am **not** proposing to change how the system stores data. I am describing how **my Excel already is**:
- I enter period totals (600, 1200, 2400).
- I need MRR = total / divisor.

Please confirm:
1. Can MRR be calculated as `base_price / divisor` where divisor comes from a CASE on `billing_frequency`? (TEXT is fine for this?)
2. Does the current import store the Excel value as-is in `base_price`? If I import 2400 for yearly, does `base_price` become 2400?
3. If yes to (2): the payment generation multiplies `base_price` by 12 for yearly. So payment would be 2400 × 12 = 28800. That would be wrong. How should we handle this — divide on import, or change how payment amount is calculated?
