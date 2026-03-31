-- Drop everything in reverse order to respect FK constraints
DROP TRIGGER IF EXISTS set_updated_at ON campaigns;
DROP TRIGGER IF EXISTS set_updated_at ON senders;
DROP TRIGGER IF EXISTS set_updated_at ON lists;
DROP TRIGGER IF EXISTS set_updated_at ON contacts;
DROP TRIGGER IF EXISTS set_updated_at ON users;
DROP TRIGGER IF EXISTS set_updated_at ON tenants;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_tenant_id() CASCADE;

DROP TABLE IF EXISTS campaign_messages CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS blacklist CASCADE;
DROP TABLE IF EXISTS senders CASCADE;
DROP TABLE IF EXISTS list_contacts CASCADE;
DROP TABLE IF EXISTS contact_tags CASCADE;
DROP TABLE IF EXISTS import_jobs CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS lists CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
