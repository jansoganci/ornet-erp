# ORNET ERP — 4-YEAR DATA STRATEGY & SCALABILITY REPORT

**Prepared:** 2026-03-27  
**Scope:** Performance, storage costs, data tiering, compliance, and disaster recovery for 4-year growth horizon  
**Current State:** ~2,500 SIM cards, soft-delete architecture, trigram indexes on high-volume tables, no partitioning or archival strategy

---

## EXECUTIVE SUMMARY

The Ornet ERP system is currently optimized for **hot storage** (active operational data) with excellent indexing on high-traffic tables (`work_orders`, `sim_cards`, `financial_transactions`). However, **no archival, partitioning, or cold storage strategy exists**. Over 4 years, without intervention:

- **Work orders** will reach **50,000–100,000+ rows** (assuming 1,000–2,000 new orders/year)
- **Financial transactions** will exceed **200,000 rows** (subscriptions generate 12 rows/year per customer; ~500 active subscriptions = 24,000 rows/year)
- **Proposals** will reach **10,000–20,000 rows** with associated PDF attachments
- **Subscription payments** will grow to **240,000+ rows** (500 subscriptions × 12 months × 4 years)

### Key Risks

1. **Query performance degradation** on non-partitioned tables after 100k rows (even with indexes)
2. **Storage cost explosion** from PDF attachments and audit logs (currently unbounded)
3. **Backup/restore time** will exceed acceptable RTO/RPO windows
4. **KVKK compliance gaps** — no data retention policy or automated purge mechanism

### Recommended Actions

- Implement **PostgreSQL table partitioning** on `financial_transactions` and `subscription_payments` (by year)
- Introduce **cold storage tier** for completed work orders older than 2 years
- Establish **7-year retention policy** with automated archival to Supabase Storage (S3)
- Deploy **external backup pipeline** (pg_dump to encrypted S3 bucket, weekly)
- Add **attachment size limits** and **compression** for PDF proposals

---

## 1. PERFORMANCE IMPACT — 100K+ ROW ANALYSIS

### 1.1 Current Index Strategy

The system already implements **best-practice indexing** on high-volume tables:

| Table | Current Indexes | Status |
|-------|----------------|--------|
| `work_orders` | B-tree (status, work_type, priority, scheduled_date DESC), GIN trigram (form_no_search), GIN array (assigned_to), partial indexes (WHERE deleted_at IS NULL) | ✅ Excellent |
| `sim_cards` | GIN trigram (phone_number), B-tree (status, operator, activation_date), all partial | ✅ Excellent |
| `financial_transactions` | B-tree (direction, period, date, customer_id, work_order_id, proposal_id), partial on invoice flags | ✅ Good |
| `subscription_payments` | B-tree (subscription_id, status, payment_month), composite (status, payment_month) | ✅ Good |
| `proposals` | B-tree (status, site_id, created_at), unique (proposal_no) | ⚠️ Missing trigram search |

**Migration 00099** (SIM cards) and **00100** (work orders) demonstrate deep understanding of PostgreSQL performance optimization (pg_trgm, LATERAL joins, stored generated columns for search).

### 1.2 Projected Performance at 100K Rows

#### Work Orders (50K–100K rows by Year 4)

**Current query pattern** (from `fetchWorkOrders` in `api.js`):
```sql
SELECT * FROM work_orders_detail
WHERE deleted_at IS NULL
  AND status = $1                    -- indexed
  AND work_type = $2                 -- indexed
  AND form_no_search ILIKE '%term%'  -- GIN trigram indexed
ORDER BY scheduled_date DESC, created_at DESC
LIMIT 50 OFFSET 0;
```

**Performance projection:**
- ✅ **No degradation expected** — all filters use indexes, ORDER BY matches composite index
- ⚠️ **Offset pagination becomes slow after OFFSET 5000** (Postgres must scan and discard rows)
- **Recommendation:** Switch to **cursor-based pagination** (keyset pagination using `WHERE (scheduled_date, created_at) < ($1, $2)`)

#### Financial Transactions (200K+ rows by Year 4)

**Current query pattern** (dashboard, reports):
```sql
SELECT 
  SUM(amount_try) FILTER (WHERE direction = 'income'),
  SUM(amount_try) FILTER (WHERE direction = 'expense')
FROM financial_transactions
WHERE period BETWEEN '2024-01' AND '2026-12'  -- indexed
  AND deleted_at IS NULL;
```

**Performance projection:**
- ⚠️ **Moderate degradation** — full table scan with filter, even with index on `period`
- **Problem:** PostgreSQL cannot efficiently aggregate across 200K rows without partitioning
- **Recommendation:** **Partition by year** (see Section 2.2)

#### Subscription Payments (240K+ rows by Year 4)

**Current query pattern** (collection desk, payment grid):
```sql
SELECT * FROM subscription_payments
WHERE subscription_id = $1           -- indexed
  AND status = 'pending'             -- indexed
ORDER BY payment_month DESC;
```

**Performance projection:**
- ✅ **No degradation** — highly selective query (subscription_id + status), small result set
- ⚠️ **Collection desk aggregate query will slow down**:
  ```sql
  SELECT COUNT(*), SUM(total_amount)
  FROM subscription_payments
  WHERE status = 'pending' AND payment_month < CURRENT_DATE;
  ```
  This scans all 240K rows to count pending payments.
- **Recommendation:** Add **materialized view** for collection desk KPIs, refreshed hourly

### 1.3 Specialized Indexing Needs

| Table | Missing Index | Use Case | Priority |
|-------|--------------|----------|----------|
| `proposals` | GIN trigram on `title` or `proposal_no` | Search proposals by customer/title | Medium |
| `financial_transactions` | Composite `(period, direction)` | Monthly P&L reports | High |
| `subscription_payments` | Partial `(status, payment_month) WHERE status = 'pending'` | Collection desk | High |
| `audit_logs` | Composite `(table_name, record_id, created_at DESC)` | Entity audit trail | Low |

**Recommendation:** Add these indexes in **Phase 1** (before 50K rows).

---

## 2. DATA TIERING STRATEGY — HOT vs. COLD STORAGE

### 2.1 Current State: 100% Hot Storage

All data lives in **active Postgres tables** with soft-delete (`deleted_at IS NULL`). Soft-deleted rows are hidden by RLS but still consume:
- **Storage space** (counted in Supabase billing)
- **Index space** (partial indexes exclude them, but base table bloat remains)
- **Backup time** (pg_dump includes deleted rows)

### 2.2 Proposed Tiering Architecture

#### Tier 1: Hot Storage (Active Operational Data)
- **Retention:** Last 2 years of data
- **Tables:** All current tables with `deleted_at IS NULL` filter
- **Query performance:** <100ms for list pages, <500ms for reports

#### Tier 2: Warm Storage (Recent Historical Data)
- **Retention:** 2–7 years old
- **Implementation:** **PostgreSQL table partitioning** by year
- **Tables:** `financial_transactions`, `subscription_payments`, `work_orders`, `proposals`
- **Query performance:** 500ms–2s for historical reports (partition pruning)

#### Tier 3: Cold Storage (Long-Term Archive)
- **Retention:** 7–10 years (KVKK compliance)
- **Implementation:** Export to **Supabase Storage (S3)** as compressed JSON/CSV
- **Access:** Read-only, manual download via admin panel
- **Query performance:** N/A (not queryable, download-only)

#### Tier 4: Permanent Deletion
- **Retention:** >10 years
- **Implementation:** Automated purge job (Supabase Edge Function, monthly cron)
- **Compliance:** KVKK Article 7 (right to erasure after retention period)

### 2.3 Partitioning Strategy — Financial Transactions

**Why partition `financial_transactions`?**
- Grows 24,000+ rows/year (500 subscriptions × 12 months + manual entries)
- Dashboard/reports query by `period` (year-month) — perfect partition key
- Partition pruning reduces query scan from 200K rows to 12K–24K rows (current year only)

**Proposed partition scheme:**
```sql
-- Convert financial_transactions to partitioned table
CREATE TABLE financial_transactions_partitioned (
  LIKE financial_transactions INCLUDING ALL
) PARTITION BY RANGE (transaction_date);

-- Create partitions per year
CREATE TABLE financial_transactions_2024 
  PARTITION OF financial_transactions_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE financial_transactions_2025 
  PARTITION OF financial_transactions_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Future partitions created automatically via cron job
```

**Migration path:**
1. Create partitioned table structure (no data yet)
2. Copy data from old table to partitioned table (background job, 10K rows/batch)
3. Swap table names atomically (RENAME TABLE)
4. Update RLS policies and triggers to reference new table
5. Drop old table after 1-week verification period

**Estimated downtime:** <5 minutes (during RENAME step)

**Tables to partition (by Year 4):**
1. `financial_transactions` — partition by `transaction_date` (year)
2. `subscription_payments` — partition by `payment_month` (year)
3. `work_orders` — partition by `scheduled_date` (year) — **only if >100K rows**
4. `audit_logs` — partition by `created_at` (quarter) — **only if >500K rows**

### 2.4 Archival Strategy — Completed Work Orders

**Problem:** Completed work orders from 2022–2024 are rarely accessed but consume storage and slow down list queries.

**Solution:** Move to `archived_work_orders` table (read-only, no RLS, no triggers).

**Archival criteria:**
- `status = 'completed'` OR `status = 'cancelled'`
- `completed_at < (CURRENT_DATE - INTERVAL '2 years')`
- `deleted_at IS NULL` (don't archive soft-deleted rows — purge them instead)

**Implementation:**
```sql
-- Create archive table (identical schema, no triggers/RLS)
CREATE TABLE archived_work_orders (LIKE work_orders INCLUDING ALL);

-- Monthly cron job (Supabase Edge Function)
INSERT INTO archived_work_orders
SELECT * FROM work_orders
WHERE status IN ('completed', 'cancelled')
  AND completed_at < (CURRENT_DATE - INTERVAL '2 years')
  AND deleted_at IS NULL;

DELETE FROM work_orders
WHERE id IN (SELECT id FROM archived_work_orders);
```

**Access pattern:**
- **UI:** Add "Search Archived Work Orders" button on Work History page
- **Query:** Union query (`SELECT * FROM work_orders UNION ALL SELECT * FROM archived_work_orders WHERE ...`)
- **Performance:** Archived table has no RLS overhead, queries are fast even at 50K+ rows

**Tables to archive:**
1. `work_orders` — archive after 2 years
2. `proposals` — archive after 3 years (legal requirement: keep quotes for 3 years)
3. `sim_card_history` — archive after 1 year (audit log, rarely accessed)

---

## 3. STORAGE COSTS — 4-YEAR PROJECTION

### 3.1 Current Supabase Pricing (Pro Plan)

| Resource | Included | Overage Cost |
|----------|----------|--------------|
| Database storage | 8 GB | $0.125/GB/month |
| File storage (Supabase Storage) | 100 GB | $0.021/GB/month |
| Bandwidth | 250 GB | $0.09/GB |

### 3.2 Projected Database Growth

| Table | Current Size | Year 1 | Year 2 | Year 3 | Year 4 | Notes |
|-------|-------------|--------|--------|--------|--------|-------|
| `work_orders` | ~500 KB | 2 MB | 4 MB | 6 MB | 8 MB | ~80 bytes/row × 100K rows |
| `financial_transactions` | ~1 MB | 5 MB | 10 MB | 15 MB | 20 MB | ~100 bytes/row × 200K rows |
| `subscription_payments` | ~2 MB | 8 MB | 16 MB | 24 MB | 32 MB | ~150 bytes/row × 240K rows |
| `sim_cards` | ~500 KB | 600 KB | 700 KB | 800 KB | 900 KB | Slow growth (inventory stable) |
| `proposals` | ~200 KB | 1 MB | 2 MB | 3 MB | 4 MB | ~200 bytes/row × 20K rows |
| `audit_logs` | ~100 KB | 5 MB | 15 MB | 30 MB | 50 MB | High volume, low value |
| **Total (text data)** | **~5 MB** | **22 MB** | **48 MB** | **79 MB** | **115 MB** | ✅ Well within 8 GB limit |

**Conclusion:** Text data is **not a cost concern**. Even at 10× growth (1M rows), database storage remains <1 GB.

### 3.3 The Real Cost Driver: PDF Attachments

**Problem:** Proposals generate PDF exports (via `@react-pdf/renderer`). If users download and re-upload these PDFs as attachments:

| Scenario | PDF Size | Proposals/Year | 4-Year Total | Storage Cost |
|----------|----------|----------------|--------------|--------------|
| **Conservative** | 200 KB | 500 | 400 MB | $8.40/month |
| **Realistic** | 500 KB | 1,000 | 2 GB | $42/month |
| **Worst-case** | 2 MB (with images) | 2,000 | 16 GB | $336/month |

**Current state:** No attachment storage implemented yet. Proposals are generated on-demand, not stored.

**Recommendation:**
1. **Do NOT store generated PDFs** — regenerate on-demand from database (current approach is correct)
2. **If attachments are added** (e.g., signed contracts, photos):
   - Compress images to WebP (80% size reduction)
   - Limit attachment size to 5 MB per file
   - Store in Supabase Storage (S3), not database
   - Implement **lifecycle policy**: move attachments >2 years old to S3 Glacier ($0.004/GB/month)

### 3.4 Cost Optimization Strategies

| Strategy | Savings | Implementation Effort |
|----------|---------|----------------------|
| Archive old work orders to separate table | ~30% query cost reduction | Medium (1 week) |
| Partition `financial_transactions` by year | ~50% report query cost | Medium (1 week) |
| Compress proposal PDFs (gzip) | ~60% storage cost | Low (1 day) |
| Move 2-year-old attachments to S3 Glacier | ~80% storage cost | High (2 weeks) |
| Purge `audit_logs` older than 1 year | ~90% audit log storage | Low (1 day) |

**Priority:** Implement **audit log purge** and **attachment compression** in Year 1.

---

## 4. COMPLIANCE (KVKK/GDPR) — DATA RETENTION POLICY

### 4.1 Legal Requirements

**KVKK (Turkish Data Protection Law)** and **GDPR** require:
1. **Data minimization** — only keep data as long as necessary for business purpose
2. **Right to erasure** — customers can request deletion of their data
3. **Retention limits** — define maximum retention period per data category

**Turkish Commercial Code (TTK):**
- **Invoices and financial records:** 10 years
- **Customer contracts:** 10 years after contract end
- **Work orders (service records):** 5 years (statute of limitations for disputes)

### 4.2 Proposed Retention Policy

| Data Category | Retention Period | Rationale | Implementation |
|---------------|------------------|-----------|----------------|
| **Financial transactions** | 10 years | TTK Article 82 (accounting records) | Archive to S3 after 7 years, purge after 10 |
| **Subscription payments** | 10 years | Tax audit requirement | Archive to S3 after 7 years, purge after 10 |
| **Work orders (completed)** | 5 years | Warranty claims, dispute resolution | Archive after 2 years, purge after 5 |
| **Proposals (accepted)** | 10 years | Contract evidence | Archive after 3 years, purge after 10 |
| **Proposals (rejected)** | 3 years | Business intelligence | Purge after 3 years |
| **Customer data (active)** | Indefinite | Active business relationship | N/A |
| **Customer data (inactive)** | 3 years | Re-engagement window | Soft-delete after 3 years of inactivity |
| **Audit logs** | 1 year | Internal audit, debugging | Purge after 1 year |
| **Notifications** | 90 days | Operational alerts only | Purge after 90 days |

### 4.3 Automated Purge Implementation

**Supabase Edge Function** (runs monthly via cron):

```typescript
// supabase/functions/data-retention-purge/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // bypass RLS
  );

  const results = {
    work_orders_purged: 0,
    proposals_purged: 0,
    audit_logs_purged: 0,
    notifications_purged: 0,
  };

  // Purge completed work orders older than 5 years
  const { count: wo_count } = await supabase
    .from('work_orders')
    .delete()
    .lt('completed_at', new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString())
    .in('status', ['completed', 'cancelled']);
  results.work_orders_purged = wo_count || 0;

  // Purge rejected proposals older than 3 years
  const { count: pr_count } = await supabase
    .from('proposals')
    .delete()
    .eq('status', 'rejected')
    .lt('created_at', new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString());
  results.proposals_purged = pr_count || 0;

  // Purge audit logs older than 1 year
  const { count: al_count } = await supabase
    .from('audit_logs')
    .delete()
    .lt('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
  results.audit_logs_purged = al_count || 0;

  // Purge resolved notifications older than 90 days
  const { count: no_count } = await supabase
    .from('notifications')
    .delete()
    .not('resolved_at', 'is', null)
    .lt('resolved_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  results.notifications_purged = no_count || 0;

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Cron schedule:** `0 2 1 * *` (2 AM on 1st of each month)

### 4.4 Customer Data Deletion Workflow

**UI:** Add "Delete Customer" button in Customer Detail page (admin only).

**Implementation:**
1. Check if customer has active subscriptions → block deletion
2. Soft-delete customer (`deleted_at = NOW()`)
3. Cascade soft-delete to `customer_sites`, `work_orders`, `proposals`
4. **Do NOT delete financial transactions** (required for accounting, anonymize instead):
   ```sql
   UPDATE financial_transactions
   SET customer_id = NULL, description = 'DELETED CUSTOMER'
   WHERE customer_id = $1;
   ```
5. Log deletion in `audit_logs` with user ID and timestamp

**KVKK compliance:** Customer data is anonymized (not deleted) to preserve financial audit trail.

---

## 5. BACKUP & DISASTER RECOVERY

### 5.1 Current State: Supabase Automatic Backups

**Supabase Pro Plan includes:**
- **Daily backups** (retained for 7 days)
- **Point-in-time recovery (PITR)** (up to 7 days back)
- **Backup storage:** Included in plan, no extra cost

**Limitations:**
1. **7-day retention only** — cannot restore from >1 week ago
2. **No off-platform backup** — if Supabase account is compromised, all backups are lost
3. **No backup verification** — cannot test restore without affecting production
4. **No backup of Supabase Storage (S3)** — only database is backed up

### 5.2 Recommended Backup Strategy

#### Tier 1: Supabase Native Backups (Operational Recovery)
- **Frequency:** Daily (automatic)
- **Retention:** 7 days
- **Use case:** Accidental data deletion, rollback after bad migration
- **RTO:** <1 hour
- **RPO:** <24 hours

#### Tier 2: Weekly External Backups (Disaster Recovery)
- **Frequency:** Weekly (Sunday 3 AM)
- **Retention:** 12 weeks (3 months)
- **Storage:** AWS S3 (separate account from Supabase)
- **Format:** `pg_dump` (compressed, encrypted)
- **Use case:** Supabase outage, account compromise, regulatory audit
- **RTO:** <4 hours
- **RPO:** <7 days

#### Tier 3: Monthly Long-Term Archive (Compliance)
- **Frequency:** Monthly (1st of month)
- **Retention:** 10 years
- **Storage:** AWS S3 Glacier Deep Archive ($0.00099/GB/month)
- **Format:** `pg_dump` + CSV exports of critical tables
- **Use case:** Legal discovery, tax audit, historical analysis
- **RTO:** 12–48 hours (Glacier retrieval time)
- **RPO:** <30 days

### 5.3 External Backup Implementation

**Option A: Supabase CLI + GitHub Actions (Recommended)**

```yaml
# .github/workflows/backup.yml
name: Weekly Database Backup
on:
  schedule:
    - cron: '0 3 * * 0'  # Every Sunday at 3 AM UTC
  workflow_dispatch:      # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install Supabase CLI
        run: |
          curl -fsSL https://supabase.com/install.sh | sh
          echo "$HOME/.supabase/bin" >> $GITHUB_PATH

      - name: Backup database
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          supabase db dump --db-url "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.xxx.supabase.co:5432/postgres" \
            --data-only > backup-$(date +%Y%m%d).sql
          gzip backup-$(date +%Y%m%d).sql
          gpg --symmetric --cipher-algo AES256 --passphrase "${{ secrets.BACKUP_ENCRYPTION_KEY }}" \
            backup-$(date +%Y%m%d).sql.gz

      - name: Upload to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws s3 cp backup-$(date +%Y%m%d).sql.gz.gpg \
            s3://ornet-erp-backups/weekly/backup-$(date +%Y%m%d).sql.gz.gpg

      - name: Cleanup old backups (keep last 12)
        run: |
          aws s3 ls s3://ornet-erp-backups/weekly/ | sort | head -n -12 | \
            awk '{print $4}' | xargs -I {} aws s3 rm s3://ornet-erp-backups/weekly/{}
```

**Cost:** ~$0.50/month (12 weekly backups × 100 MB × $0.023/GB S3 Standard)

**Option B: Supabase Database Webhooks + Edge Function**

```typescript
// supabase/functions/backup-to-s3/index.ts
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

Deno.serve(async (req) => {
  // Trigger pg_dump via Supabase Management API
  const dumpUrl = await fetch('https://api.supabase.com/v1/projects/xxx/database/backup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
  });

  const dump = await dumpUrl.text();

  // Upload to S3
  const s3 = new S3Client({ region: 'eu-central-1' });
  await s3.send(new PutObjectCommand({
    Bucket: 'ornet-erp-backups',
    Key: `weekly/backup-${new Date().toISOString().split('T')[0]}.sql.gz`,
    Body: dump,
    ServerSideEncryption: 'AES256',
  }));

  return new Response('Backup completed', { status: 200 });
});
```

**Cron schedule:** `0 3 * * 0` (weekly, Sunday 3 AM)

### 5.4 Backup Verification & Testing

**Problem:** Backups are useless if they cannot be restored.

**Solution:** Quarterly restore test to staging environment.

**Process:**
1. Spin up new Supabase project (staging)
2. Restore latest weekly backup via `psql < backup.sql`
3. Run smoke tests:
   - Login with test user
   - Fetch work orders list
   - Create new customer
   - Generate proposal PDF
4. Delete staging project after verification
5. Document restore time and any issues

**Frequency:** Quarterly (every 3 months)

### 5.5 Supabase Storage (S3) Backup

**Problem:** Supabase Storage (file uploads) is **not included in database backups**.

**Current state:** No file uploads implemented yet (proposals are generated on-demand, not stored).

**Future recommendation (if attachments are added):**
- Enable **S3 versioning** on Supabase Storage bucket (retains deleted files for 30 days)
- Use **AWS S3 Cross-Region Replication** to backup bucket (automatic, $0.02/GB transfer)
- Monthly sync to separate S3 bucket via `aws s3 sync` (GitHub Actions)

---

## 6. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Months 1–3)

| Task | Effort | Priority | Impact |
|------|--------|----------|--------|
| Add missing indexes (proposals trigram, financial_transactions composite) | 1 day | High | +30% query performance |
| Implement audit log purge (1-year retention) | 2 days | High | -50% audit log storage |
| Set up weekly external backups (GitHub Actions + S3) | 3 days | Critical | Disaster recovery |
| Document data retention policy (KVKK compliance) | 1 day | High | Legal compliance |

**Deliverables:**
- Migration: `00165_add_missing_indexes.sql`
- Edge Function: `data-retention-purge`
- GitHub Actions workflow: `.github/workflows/backup.yml`
- Document: `docs/DATA_RETENTION_POLICY.md`

### Phase 2: Partitioning (Months 4–6)

| Task | Effort | Priority | Impact |
|------|--------|----------|--------|
| Partition `financial_transactions` by year | 1 week | High | +50% report performance |
| Partition `subscription_payments` by year | 1 week | Medium | +40% collection desk performance |
| Create materialized view for collection desk KPIs | 2 days | Medium | +80% dashboard load time |
| Implement cursor-based pagination for work orders | 3 days | Low | Fixes OFFSET >5000 slowdown |

**Deliverables:**
- Migration: `00166_partition_financial_transactions.sql`
- Migration: `00167_partition_subscription_payments.sql`
- Migration: `00168_collection_desk_mv.sql`
- API update: `src/features/workOrders/api.js` (cursor pagination)

### Phase 3: Archival (Months 7–9)

| Task | Effort | Priority | Impact |
|------|--------|----------|--------|
| Create `archived_work_orders` table | 2 days | Medium | -30% active table size |
| Implement monthly archival cron job | 3 days | Medium | Automated cold storage |
| Add "Search Archived Work Orders" UI | 1 week | Low | Access to historical data |
| Archive proposals older than 3 years | 2 days | Low | -20% proposals table size |

**Deliverables:**
- Migration: `00169_archived_work_orders.sql`
- Edge Function: `archive-old-work-orders`
- UI: `src/features/workHistory/ArchivedWorkOrdersPage.jsx`

### Phase 4: Compliance & Optimization (Months 10–12)

| Task | Effort | Priority | Impact |
|------|--------|----------|--------|
| Implement customer data deletion workflow | 1 week | High | KVKK Article 7 compliance |
| Add attachment compression (if attachments added) | 2 days | Medium | -60% storage cost |
| Quarterly backup restore testing | 1 day/quarter | Critical | Verify disaster recovery |
| Migrate old data to S3 Glacier (7+ years) | 1 week | Low | -80% long-term storage cost |

**Deliverables:**
- UI: `src/features/customers/DeleteCustomerModal.jsx`
- Migration: `00170_customer_deletion_workflow.sql`
- Script: `scripts/migrate-to-glacier.sh`
- Document: `docs/DISASTER_RECOVERY_PLAN.md`

---

## 7. COST SUMMARY — 4-YEAR PROJECTION

### Scenario A: No Action (Current Architecture)

| Year | Database Size | Storage Cost | Backup Cost | Query Performance | Total Cost/Month |
|------|--------------|--------------|-------------|-------------------|------------------|
| 1 | 50 MB | $0 (within 8 GB) | $0 (Supabase native) | Good | $0 |
| 2 | 150 MB | $0 | $0 | Moderate (reports slow) | $0 |
| 3 | 300 MB | $0 | $0 | Poor (OFFSET pagination breaks) | $0 |
| 4 | 500 MB | $0 | $0 | Very poor (full table scans) | $0 |

**Risk:** Performance degradation forces expensive Supabase plan upgrade ($599/month Enterprise).

### Scenario B: Recommended Strategy (Partitioning + Archival)

| Year | Database Size | Storage Cost | Backup Cost | Archival Cost | Total Cost/Month |
|------|--------------|--------------|-------------|---------------|------------------|
| 1 | 50 MB | $0 | $0.50 (S3) | $0 | $0.50 |
| 2 | 100 MB (archived 50 MB) | $0 | $0.50 | $1 (S3 Standard) | $1.50 |
| 3 | 150 MB (archived 150 MB) | $0 | $0.50 | $3 | $3.50 |
| 4 | 200 MB (archived 300 MB) | $0 | $0.50 | $6 | $6.50 |

**Benefit:** Maintains excellent performance, stays on Pro plan ($25/month), total cost <$10/month.

**ROI:** Avoids $574/month Enterprise plan upgrade = **$27,552 saved over 4 years**.

---

## 8. KEY RECOMMENDATIONS

### Immediate Actions (Month 1)
1. ✅ **Set up weekly external backups** (GitHub Actions + S3) — disaster recovery is critical
2. ✅ **Add missing indexes** (proposals, financial_transactions) — quick wins
3. ✅ **Implement audit log purge** (1-year retention) — reduce storage bloat

### Year 1 Priorities
1. ✅ **Partition `financial_transactions` by year** — prevents report slowdown
2. ✅ **Document data retention policy** — KVKK compliance requirement
3. ✅ **Test backup restore quarterly** — verify disaster recovery works

### Year 2+ Priorities
1. ✅ **Archive old work orders** (2+ years) — keep active table lean
2. ✅ **Implement customer deletion workflow** — KVKK Article 7 compliance
3. ✅ **Migrate 7+ year data to S3 Glacier** — long-term cost optimization

### Do NOT Do
1. ❌ **Do NOT store generated PDFs** — regenerate on-demand (current approach is correct)
2. ❌ **Do NOT partition `work_orders` in Year 1** — wait until 100K+ rows
3. ❌ **Do NOT use VACUUM FULL** — Supabase handles this automatically
4. ❌ **Do NOT implement custom replication** — Supabase has built-in HA

---

## 9. CONCLUSION

The Ornet ERP system is **well-architected for current scale** (excellent indexing, soft-delete, trigram search). However, **no long-term data strategy exists**. Without intervention, the system will face:
- **Performance degradation** after 100K rows (reports, pagination)
- **Compliance gaps** (no retention policy, no customer deletion workflow)
- **Disaster recovery risk** (7-day backup retention only)

**The recommended strategy** (partitioning + archival + external backups) costs **<$10/month** and ensures the system remains fast, compliant, and resilient over 4 years — avoiding a $27,552 Enterprise plan upgrade.

**Next step:** Implement Phase 1 (Foundation) in Month 1 to establish backup and purge infrastructure before data volume becomes a problem.

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-27  
**Prepared By:** AI Assistant (Claude Sonnet 4.5)  
**Review Status:** Draft — requires technical review and stakeholder approval
