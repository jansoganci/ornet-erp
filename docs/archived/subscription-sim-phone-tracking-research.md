# Subscription ↔ SIM Card Phone Tracking — Research

**Status:** Research Complete  
**Date:** 2025-02-12

---

## 1. Does `subscriptions` table have a phone number field?

**No.**

| Table | Phone-related columns |
|-------|-----------------------|
| `subscriptions` | **None** |
| `customer_sites` | `contact_phone` (site contact) |
| `customers` | `phone`, `phone_secondary` |
| `sim_cards` | `phone_number` (unique) |

`subscriptions` only has `site_id`; it does not store a SIM phone number or reference a SIM card.

---

## 2. When creating a subscription, is phone number entered in the form?

**No.**

The subscription form (`SubscriptionFormPage.jsx`) uses:

- `CustomerSiteSelector` → `site_id`
- `subscription_type`, `start_date`, `billing_day`
- `base_price`, `sms_fee`, `line_fee`, `vat_rate`, `cost`
- `service_type`, `billing_frequency`
- `payment_method_id`, `cash_collector_id`, card details
- `notes`, `setup_notes`

There is no field for SIM phone number or SIM card selection.

---

## 3. Is there any link between `subscriptions` and `sim_cards`?

**No direct link.**

| Connection | Exists? |
|------------|---------|
| `subscriptions.sim_card_id` | No |
| `subscriptions.phone_number` | No |
| `sim_cards.subscription_id` | No |
| Shared `site_id` | Yes (both reference `customer_sites`) |

Indirect relation:

- `subscriptions.site_id` → `customer_sites.id`
- `sim_cards.site_id` → `customer_sites.id`

So both can refer to the same site, but there is no explicit link between a subscription and a SIM card.

---

## 4. Can we automatically update `sim_cards.status` based on subscription creation/cancellation?

**Not with the current schema.** There is no way to know which SIM belongs to which subscription.

---

## 5. Recommended Implementation Approach

### Option A: Add `sim_card_id` to `subscriptions` (recommended)

**Idea:** Store a direct FK to `sim_cards` when creating a subscription.

**Pros:**

- Single source of truth
- No risk of phone number mismatch
- Simple and robust

**Cons:**

- Requires UI change: user must select a SIM when creating a subscription

**Flow:**

1. User selects site (as today).
2. User selects SIM (dropdown of SIMs for that site, or `available` SIMs).
3. On save: `subscriptions.sim_card_id` is set.
4. Trigger on `subscriptions` INSERT: set `sim_cards.status = 'subscription'` where `id = NEW.sim_card_id`.
5. Trigger on `subscriptions` UPDATE (status → cancelled): set `sim_cards.status = 'inactive'` where `subscription_id = NEW.id` (or via `sim_card_id`).

---

### Option B: Add `phone_number` to `subscriptions`

**Idea:** Store the SIM phone number when creating a subscription.

**Pros:**

- User enters a number they know
- No need to load SIM list first

**Cons:**

- Phone might not exist in `sim_cards`.
- Phone might belong to another site.
- Typo or format differences can break matching.

**Flow:**

1. Add `subscriptions.phone_number` (nullable TEXT).
2. Add input to subscription form.
3. Trigger on INSERT: find `sim_cards` where `phone_number = NEW.phone_number` and `site_id = NEW.site_id`, update status to `'subscription'`.
4. Trigger on UPDATE (status → cancelled): find SIM by `subscription_id` (requires storing the link somewhere) or by `phone_number` + `site_id`.

**Matching logic:**

```sql
UPDATE sim_cards
SET status = 'subscription', customer_id = (SELECT customer_id FROM customer_sites WHERE id = NEW.site_id), site_id = NEW.site_id
WHERE phone_number = NEW.phone_number
  AND (site_id = NEW.site_id OR site_id IS NULL);
```

---

### Option C: Use `customer_sites.contact_phone`

**Idea:** Treat site contact phone as the SIM phone.

**Pros:**

- No schema change to `subscriptions`.

**Cons:**

- `contact_phone` is often the site contact, not the SIM.
- One site can have multiple SIMs.
- Unreliable for automation.

**Verdict:** Not recommended.

---

## 6. Required Changes

### 6.1 New `sim_card_status` value

Add `'subscription'` to the enum:

```sql
ALTER TYPE sim_card_status ADD VALUE 'subscription';
```

**Note:** PostgreSQL does not support removing enum values. If needed, use a migration that creates a new enum and migrates.

---

### 6.2 Option A: Add `sim_card_id` to `subscriptions`

**Migration:**

```sql
ALTER TABLE subscriptions
  ADD COLUMN sim_card_id UUID REFERENCES sim_cards(id) ON DELETE SET NULL;

CREATE INDEX idx_subscriptions_sim_card ON subscriptions(sim_card_id);
```

**Trigger on subscription INSERT:**

```sql
CREATE OR REPLACE FUNCTION fn_subscription_sim_status_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sim_card_id IS NOT NULL THEN
    UPDATE sim_cards
    SET status = 'subscription',
        customer_id = (SELECT customer_id FROM customer_sites WHERE id = NEW.site_id),
        site_id = NEW.site_id
    WHERE id = NEW.sim_card_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_sim_insert
  AFTER INSERT ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_subscription_sim_status_on_insert();
```

**Trigger on subscription UPDATE (cancellation):**

```sql
CREATE OR REPLACE FUNCTION fn_subscription_sim_status_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status <> 'cancelled') THEN
    IF NEW.sim_card_id IS NOT NULL THEN
      UPDATE sim_cards
      SET status = 'inactive'
      WHERE id = NEW.sim_card_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_sim_cancel
  AFTER UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_subscription_sim_status_on_cancel();
```

---

### 6.3 Option B: Add `phone_number` to `subscriptions`

**Migration:**

```sql
ALTER TABLE subscriptions
  ADD COLUMN phone_number TEXT;
```

**Trigger on INSERT:**

```sql
CREATE OR REPLACE FUNCTION fn_subscription_sim_by_phone_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL AND trim(NEW.phone_number) <> '' THEN
    UPDATE sim_cards
    SET status = 'subscription',
        customer_id = (SELECT customer_id FROM customer_sites WHERE id = NEW.site_id),
        site_id = NEW.site_id
    WHERE phone_number = trim(NEW.phone_number)
      AND (site_id = NEW.site_id OR site_id IS NULL);
  END IF;
  RETURN NEW;
END;
$$;
```

**Trigger on UPDATE (cancellation) — same pattern as Option A, but match by phone:**

```sql
IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND NEW.phone_number IS NOT NULL THEN
  UPDATE sim_cards
  SET status = 'inactive'
  WHERE phone_number = trim(NEW.phone_number) AND site_id = NEW.site_id;
END IF;
```

**Note:** Matching by phone + site. If the same phone appears in multiple sites (unlikely), all matching rows are updated.

---

## 7. UI Changes

### Option A (sim_card_id)

1. Add a SIM selector to the subscription form (e.g. combobox).
2. Filter SIMs by site: `available` SIMs, or SIMs already assigned to the selected site.
3. Submit `sim_card_id` when creating/updating a subscription.

### Option B (phone_number)

1. Add a phone number input to the subscription form.
2. Optional: validate that the number exists in `sim_cards` for the selected site.
3. Submit `phone_number` when creating a subscription.

---

## 8. Status semantics

| Status | Meaning |
|--------|---------|
| `available` | Not assigned |
| `active` | Assigned, used for wholesale/rental (revenue from sim_rental) |
| `subscription` | Assigned to a subscription (revenue from subscription/line_fee) |
| `inactive` | No longer in use |
| `sold` | Sold to customer |

---

## 9. Summary

| Question | Answer |
|----------|--------|
| Does `subscriptions` have phone? | No |
| Is phone entered in subscription form? | No |
| Link between subscriptions and sim_cards? | No |
| Auto-update SIM status? | Not possible with current schema |

**Recommendation:** Use Option A (`sim_card_id` on `subscriptions`) and add a SIM selector to the subscription form. Add the `subscription` status and the triggers above.
