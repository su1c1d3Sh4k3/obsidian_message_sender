-- Migration: Add birthday system
-- Run this in Supabase SQL Editor or via run-schema.mjs

-- 1. Add birth_date column to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birth_date DATE;
CREATE INDEX IF NOT EXISTS idx_contacts_birth_date ON contacts(tenant_id, birth_date) WHERE birth_date IS NOT NULL;

-- 2. Create birthday_campaigns table
CREATE TABLE IF NOT EXISTS birthday_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    message_type VARCHAR(20) DEFAULT 'text',
    message_body TEXT NOT NULL,
    media_url TEXT,
    media_filename VARCHAR(255),
    media_caption TEXT,
    sender_id UUID REFERENCES senders(id),
    sender_ids UUID[],
    delay_min INT DEFAULT 15,
    delay_max INT DEFAULT 45,
    use_spintax BOOLEAN DEFAULT false,
    send_time TIME NOT NULL DEFAULT '09:00',
    total_sent INT DEFAULT 0,
    last_run_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active birthday campaign per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_birthday_campaigns_active ON birthday_campaigns(tenant_id) WHERE is_active = true;

-- 3. RLS
ALTER TABLE birthday_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON birthday_campaigns
    FOR ALL USING (tenant_id = public.get_tenant_id());

-- 4. Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON birthday_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
