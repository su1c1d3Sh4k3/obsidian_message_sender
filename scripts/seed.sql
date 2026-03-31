-- Seed: Tags
INSERT INTO tags (tenant_id, name, color) VALUES
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Lead Quente', '#a78bfa'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'VIP', '#71717a'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Qualificado', '#34d399'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Follow-up', '#71717a'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'B2B', '#34d399')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Seed: Contacts
INSERT INTO contacts (tenant_id, first_name, last_name, display_name, phone, phone_raw, city, state, organization, is_valid, source) VALUES
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Ricardo',  'Lemos',       'Ricardo Lemos',       '5511988776655', '11988776655', 'São Paulo',        'SP', 'Tech Solutions',   true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Mariana',  'Silva',       'Mariana Silva',       '5521977665544', '21977665544', 'Rio de Janeiro',   'RJ', 'Agência MKT',      true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Fernando', 'Torres',      'Fernando Torres',     '5531999112233', '31999112233', 'Belo Horizonte',   'MG', NULL,               true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Ana',      'Costa',       'Ana Costa',           '5541988223344', '41988223344', 'Curitiba',         'PR', 'Construtora ABC',  true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Carlos',   'Mendes',      'Carlos Mendes',       '5531977665544', '31977665544', 'Belo Horizonte',   'MG', 'Advocacia Mendes', true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Juliana',  'Rocha',       'Juliana Rocha',       '5511944332211', '11944332211', 'São Paulo',        'SP', NULL,               false,'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Pedro',    'Oliveira',    'Pedro Oliveira',      '5521966554433', '21966554433', 'Niterói',          'RJ', 'PE Consulting',    true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Beatriz',  'Almeida',     'Beatriz Almeida',     '5531988997766', '31988997766', 'Contagem',         'MG', 'Studio Bea',       true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Lucas',    'Ferreira',    'Lucas Ferreira',      '5571999887766', '71999887766', 'Salvador',         'BA', NULL,               true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Camila',   'Nascimento',  'Camila Nascimento',   '5561977665544', '61977665544', 'Brasília',         'DF', 'Gov Solutions',    true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Roberto',  'Santos',      'Roberto Santos',      '5531944556677', '31944556677', 'Betim',            'MG', 'RS Imports',       true, 'manual'),
  ('a89971d0-b4be-4830-9aa0-7d40e38c7934', 'Patrícia', 'Lima',        'Patrícia Lima',       '5511933445566', '11933445566', 'Guarulhos',        'SP', NULL,               true, 'manual')
ON CONFLICT (tenant_id, phone) DO NOTHING;

-- Seed: Contact tags (link contacts to tags)
-- Lead Quente → Ricardo, Ana, Lucas
INSERT INTO contact_tags (contact_id, tag_id)
SELECT c.id, t.id FROM contacts c, tags t
WHERE c.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.name = 'Lead Quente'
  AND c.display_name IN ('Ricardo Lemos', 'Ana Costa', 'Lucas Ferreira')
ON CONFLICT DO NOTHING;

-- VIP → Ricardo, Pedro
INSERT INTO contact_tags (contact_id, tag_id)
SELECT c.id, t.id FROM contacts c, tags t
WHERE c.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.name = 'VIP'
  AND c.display_name IN ('Ricardo Lemos', 'Pedro Oliveira')
ON CONFLICT DO NOTHING;

-- Qualificado → Mariana, Beatriz, Patrícia
INSERT INTO contact_tags (contact_id, tag_id)
SELECT c.id, t.id FROM contacts c, tags t
WHERE c.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.name = 'Qualificado'
  AND c.display_name IN ('Mariana Silva', 'Beatriz Almeida', 'Patrícia Lima')
ON CONFLICT DO NOTHING;

-- Follow-up → Fernando, Camila
INSERT INTO contact_tags (contact_id, tag_id)
SELECT c.id, t.id FROM contacts c, tags t
WHERE c.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.name = 'Follow-up'
  AND c.display_name IN ('Fernando Torres', 'Camila Nascimento')
ON CONFLICT DO NOTHING;

-- B2B → Carlos, Beatriz
INSERT INTO contact_tags (contact_id, tag_id)
SELECT c.id, t.id FROM contacts c, tags t
WHERE c.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934'
  AND t.name = 'B2B'
  AND c.display_name IN ('Carlos Mendes', 'Beatriz Almeida')
ON CONFLICT DO NOTHING;

-- Set Pedro as blacklisted
UPDATE contacts SET is_blacklisted = true
WHERE tenant_id = 'a89971d0-b4be-4830-9aa0-7d40e38c7934' AND display_name = 'Pedro Oliveira';
