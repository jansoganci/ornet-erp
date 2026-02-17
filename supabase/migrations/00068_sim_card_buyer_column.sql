-- Add buyer_id to SIM cards, remove unused columns (imsi, iccid, account_no)
-- Path: supabase/migrations/00068_sim_card_buyer_column.sql

-- 1. Drop unused columns
ALTER TABLE sim_cards DROP COLUMN IF EXISTS imsi;
ALTER TABLE sim_cards DROP COLUMN IF EXISTS iccid;
ALTER TABLE sim_cards DROP COLUMN IF EXISTS account_no;

-- 2. Add buyer_id column
ALTER TABLE sim_cards ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sim_cards_buyer_id ON sim_cards(buyer_id);

-- 3. Add buyer tracking columns to history table
ALTER TABLE sim_card_history ADD COLUMN IF NOT EXISTS old_buyer_id UUID;
ALTER TABLE sim_card_history ADD COLUMN IF NOT EXISTS new_buyer_id UUID;

-- 4. Replace the history logging function to track buyer_id changes
CREATE OR REPLACE FUNCTION log_sim_card_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status
            OR OLD.customer_id IS DISTINCT FROM NEW.customer_id
            OR OLD.site_id IS DISTINCT FROM NEW.site_id
            OR OLD.buyer_id IS DISTINCT FROM NEW.buyer_id) THEN
            INSERT INTO sim_card_history (
                sim_card_id,
                old_status, new_status,
                old_customer_id, new_customer_id,
                old_site_id, new_site_id,
                old_buyer_id, new_buyer_id,
                action,
                changed_by
            ) VALUES (
                NEW.id,
                OLD.status, NEW.status,
                OLD.customer_id, NEW.customer_id,
                OLD.site_id, NEW.site_id,
                OLD.buyer_id, NEW.buyer_id,
                'status_change',
                auth.uid()
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO sim_card_history (
            sim_card_id,
            new_status,
            new_customer_id,
            new_site_id,
            new_buyer_id,
            action,
            changed_by
        ) VALUES (
            NEW.id,
            NEW.status,
            NEW.customer_id,
            NEW.site_id,
            NEW.buyer_id,
            'import',
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';
