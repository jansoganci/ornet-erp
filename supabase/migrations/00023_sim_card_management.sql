-- SIM Card Management System Migration
-- Path: supabase/migrations/00023_sim_card_management.sql

-- Create custom types for SIM card management
DO $$ BEGIN
    CREATE TYPE sim_card_status AS ENUM ('available', 'active', 'inactive', 'sold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sim_operator AS ENUM ('TURKCELL', 'VODAFONE', 'TURK_TELEKOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create sim_cards table
CREATE TABLE IF NOT EXISTS sim_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    imsi TEXT UNIQUE,
    iccid TEXT, -- GPRS/EBS Serial No
    operator sim_operator NOT NULL DEFAULT 'TURKCELL',
    capacity TEXT, -- e.g., '100MB', '1GB'
    account_no TEXT, -- AİM Account No (e.g., 585D)
    status sim_card_status NOT NULL DEFAULT 'available',
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    site_id UUID REFERENCES customer_sites(id) ON DELETE SET NULL,
    cost_price DECIMAL(12, 2) DEFAULT 0,
    sale_price DECIMAL(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'TRY',
    activation_date TIMESTAMPTZ,
    deactivation_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sim_card_history table for audit log
CREATE TABLE IF NOT EXISTS sim_card_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sim_card_id UUID REFERENCES sim_cards(id) ON DELETE CASCADE,
    old_status sim_card_status,
    new_status sim_card_status,
    old_customer_id UUID,
    new_customer_id UUID,
    old_site_id UUID,
    new_site_id UUID,
    action TEXT NOT NULL, -- 'status_change', 'assignment', 'price_update', 'import'
    notes TEXT,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE sim_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_card_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sim_cards
CREATE POLICY "Authenticated users can read sim_cards"
    ON sim_cards FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage sim_cards"
    ON sim_cards FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'accountant')
        )
    );

-- RLS Policies for sim_card_history
CREATE POLICY "Authenticated users can read sim_card_history"
    ON sim_card_history FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage sim_card_history"
    ON sim_card_history FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'accountant')
        )
    );

-- Create updated_at trigger for sim_cards
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sim_cards_updated_at
    BEFORE UPDATE ON sim_cards
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Create a function to log sim card history automatically
CREATE OR REPLACE FUNCTION log_sim_card_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status OR OLD.customer_id IS DISTINCT FROM NEW.customer_id OR OLD.site_id IS DISTINCT FROM NEW.site_id) THEN
            INSERT INTO sim_card_history (
                sim_card_id,
                old_status,
                new_status,
                old_customer_id,
                new_customer_id,
                old_site_id,
                new_site_id,
                action,
                changed_by
            ) VALUES (
                NEW.id,
                OLD.status,
                NEW.status,
                OLD.customer_id,
                NEW.customer_id,
                OLD.site_id,
                NEW.site_id,
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
            action,
            changed_by
        ) VALUES (
            NEW.id,
            NEW.status,
            NEW.customer_id,
            NEW.site_id,
            'import',
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_sim_card_history_trigger
    AFTER INSERT OR UPDATE ON sim_cards
    FOR EACH ROW
    EXECUTE PROCEDURE log_sim_card_history();
