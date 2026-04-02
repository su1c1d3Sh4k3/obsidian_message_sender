-- ============================================
-- OBSIDIAN MSGR - Schema Completo
-- Disparador de Mensagens WhatsApp
-- ============================================

-- 1. TENANTS
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TAGS
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- 4. LISTS
CREATE TABLE lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    contact_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. IMPORT_JOBS (before contacts, because contacts references it)
CREATE TABLE import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    file_url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    total_rows INT DEFAULT 0,
    imported_count INT DEFAULT 0,
    skipped_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    errors JSONB DEFAULT '[]',
    column_mapping JSONB,
    auto_tag_id UUID REFERENCES tags(id),
    auto_list_id UUID REFERENCES lists(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CONTACTS
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    phone_raw VARCHAR(50),
    email VARCHAR(255),
    organization VARCHAR(255),
    organization_title VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(100),
    address TEXT,
    birth_date DATE,
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    last_message_at TIMESTAMPTZ,
    is_valid BOOLEAN DEFAULT true,
    is_blacklisted BOOLEAN DEFAULT false,
    source VARCHAR(100) DEFAULT 'manual',
    import_job_id UUID REFERENCES import_jobs(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON contacts(tenant_id, phone);
CREATE INDEX idx_contacts_city ON contacts(tenant_id, city);
CREATE INDEX idx_contacts_blacklisted ON contacts(tenant_id, is_blacklisted) WHERE is_blacklisted = true;
CREATE INDEX idx_contacts_birth_date ON contacts(tenant_id, birth_date) WHERE birth_date IS NOT NULL;

-- 7. CONTACT_TAGS (N:N)
CREATE TABLE contact_tags (
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);

-- 8. LIST_CONTACTS (N:N)
CREATE TABLE list_contacts (
    list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (list_id, contact_id)
);

-- 9. SENDERS (instâncias Uzapi)
CREATE TABLE senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    uzapi_instance_id VARCHAR(255) NOT NULL,
    uzapi_token VARCHAR(500) NOT NULL,
    uzapi_url VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'disconnected',
    last_seen_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CAMPAIGNS
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    target_type VARCHAR(20) NOT NULL,
    target_list_id UUID REFERENCES lists(id),
    target_tag_id UUID REFERENCES tags(id),
    target_filter JSONB,
    message_type VARCHAR(20) DEFAULT 'text',
    message_body TEXT NOT NULL,
    media_url TEXT,
    media_filename VARCHAR(255),
    media_caption TEXT,
    sender_id UUID REFERENCES senders(id),
    sender_ids UUID[],
    delay_min INT DEFAULT 15,
    delay_max INT DEFAULT 45,
    daily_limit INT,
    use_spintax BOOLEAN DEFAULT false,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_contacts INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_scheduled ON campaigns(status, scheduled_at) WHERE status = 'scheduled';

-- 11. CAMPAIGN_MESSAGES (logs de envio)
CREATE TABLE campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id),
    sender_id UUID REFERENCES senders(id),
    phone VARCHAR(20) NOT NULL,
    contact_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    message_rendered TEXT,
    error_message TEXT,
    uzapi_message_id VARCHAR(255),
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cm_campaign ON campaign_messages(campaign_id);
CREATE INDEX idx_cm_status ON campaign_messages(campaign_id, status);
CREATE INDEX idx_cm_contact ON campaign_messages(contact_id);

-- 12. BIRTHDAY_CAMPAIGNS (1 ativa por tenant)
CREATE TABLE birthday_campaigns (
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
CREATE UNIQUE INDEX idx_birthday_campaigns_active ON birthday_campaigns(tenant_id) WHERE is_active = true;

-- 13. BLACKLIST (LGPD)
CREATE TABLE blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    reason VARCHAR(255) DEFAULT 'opt-out',
    source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Helper function to get tenant_id from authenticated user
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: tenant isolation
CREATE POLICY "tenant_isolation" ON tenants
    FOR ALL USING (id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON users
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON contacts
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON tags
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON lists
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON senders
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON campaigns
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON campaign_messages
    FOR ALL USING (campaign_id IN (
        SELECT id FROM campaigns WHERE tenant_id = public.get_tenant_id()
    ));

CREATE POLICY "tenant_isolation" ON blacklist
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON birthday_campaigns
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON import_jobs
    FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_isolation" ON contact_tags
    FOR ALL USING (contact_id IN (
        SELECT id FROM contacts WHERE tenant_id = public.get_tenant_id()
    ));

CREATE POLICY "tenant_isolation" ON list_contacts
    FOR ALL USING (list_id IN (
        SELECT id FROM lists WHERE tenant_id = public.get_tenant_id()
    ));

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON senders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON birthday_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
