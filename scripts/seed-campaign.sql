-- Seed: Campaign mock completa com logs de envio

-- 1. Campanha já enviada (completed)
INSERT INTO campaigns (
  id, tenant_id, created_by, name, status,
  target_type, message_type, message_body,
  delay_min, delay_max, use_spintax,
  total_contacts, sent_count, delivered_count, failed_count,
  started_at, completed_at, created_at
) VALUES (
  'c0000001-0000-0000-0000-000000000001',
  'a89971d0-b4be-4830-9aa0-7d40e38c7934',
  'c292d196-0479-47e8-8a02-e4dd72375def',
  'Promoção Páscoa 2026',
  'completed',
  'list', 'text',
  '{Olá|Oi} {{primeiro_nome}}, tudo bem? Temos uma *promoção especial* de Páscoa pra você! 🐣 Acesse nosso site e confira.',
  15, 30, true,
  10, 10, 8, 2,
  '2026-03-29 10:00:00+00',
  '2026-03-29 10:45:00+00',
  '2026-03-28 18:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- 2. Campanha em andamento (running)
INSERT INTO campaigns (
  id, tenant_id, created_by, name, status,
  target_type, message_type, message_body,
  delay_min, delay_max, use_spintax,
  total_contacts, sent_count, delivered_count, failed_count,
  started_at, created_at
) VALUES (
  'c0000002-0000-0000-0000-000000000002',
  'a89971d0-b4be-4830-9aa0-7d40e38c7934',
  'c292d196-0479-47e8-8a02-e4dd72375def',
  'Follow-up Março - BH',
  'running',
  'list', 'text',
  'Oi {{primeiro_nome}}, aqui é da _Obsidian MSGR_. Vimos que você demonstrou interesse nos nossos serviços. Podemos conversar?',
  20, 45, false,
  10, 6, 5, 1,
  '2026-03-30 14:00:00+00',
  '2026-03-30 12:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- 3. Campanha aguardando envio (draft)
INSERT INTO campaigns (
  id, tenant_id, created_by, name, status,
  target_type, message_type, message_body,
  delay_min, delay_max, use_spintax,
  total_contacts, sent_count, delivered_count, failed_count,
  created_at
) VALUES (
  'c0000003-0000-0000-0000-000000000003',
  'a89971d0-b4be-4830-9aa0-7d40e38c7934',
  'c292d196-0479-47e8-8a02-e4dd72375def',
  'Lançamento Abril - Nacional',
  'draft',
  'list', 'text',
  '{Bom dia|Boa tarde} {{primeiro_nome}}! Temos novidades *exclusivas* da {{empresa}} para o mês de abril. Confira!',
  15, 30, true,
  10, 0, 0, 0,
  '2026-03-30 16:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════
-- Logs da campanha 1 (completed) - 10 mensagens
-- ═══════════════════════════════════════════════

INSERT INTO campaign_messages (campaign_id, contact_id, phone, contact_name, status, message_rendered, sent_at, delivered_at, created_at) VALUES
('c0000001-0000-0000-0000-000000000001', '2e893ab9-7a59-496c-800e-280fcdea18bc', '5541988223344', 'Ana Costa',         'delivered', 'Oi Ana, tudo bem? Temos uma promoção especial de Páscoa pra você! 🐣 Acesse nosso site e confira.',      '2026-03-29 10:00:15+00', '2026-03-29 10:00:18+00', '2026-03-29 10:00:00+00'),
('c0000001-0000-0000-0000-000000000001', 'a95a58b8-5eaa-4158-8667-cbfd430f5767', '5531988997766', 'Beatriz Almeida',   'delivered', 'Olá Beatriz, tudo bem? Temos uma promoção especial de Páscoa pra você! 🐣 Acesse nosso site e confira.', '2026-03-29 10:03:22+00', '2026-03-29 10:03:25+00', '2026-03-29 10:03:00+00'),
('c0000001-0000-0000-0000-000000000001', '4dfe6dfe-f36d-4b8b-80f9-21b891c874db', '5561977665544', 'Camila Nascimento', 'delivered', 'Oi Camila, tudo bem? Temos uma promoção especial de Páscoa pra você! 🐣 Acesse nosso site e confira.',   '2026-03-29 10:06:45+00', '2026-03-29 10:06:48+00', '2026-03-29 10:06:00+00'),
('c0000001-0000-0000-0000-000000000001', 'cfd3ef09-ed69-4ef0-9824-4335d58ceed4', '5531977665544', 'Carlos Mendes',     'read',      'Olá Carlos, tudo bem? Temos uma promoção especial de Páscoa pra você! 🐣 Acesse nosso site e confira.',  '2026-03-29 10:10:10+00', '2026-03-29 10:10:13+00', '2026-03-29 10:10:00+00'),
('c0000001-0000-0000-0000-000000000001', '6fd8a8c3-e416-45b6-b83a-a9cd1897dcad', '5531999112233', 'Fernando Torres',   'failed',    NULL, NULL, NULL, '2026-03-29 10:14:00+00'),
('c0000001-0000-0000-0000-000000000001', '07b8697a-7add-4d82-ba51-72d02f12807b', '5511944332211', 'Juliana Rocha',     'delivered', 'Oi Juliana, tudo bem? Temos uma promoção especial de Páscoa pra você! 🐣 Acesse nosso site e confira.',  '2026-03-29 10:18:30+00', '2026-03-29 10:18:33+00', '2026-03-29 10:18:00+00'),
('c0000001-0000-0000-0000-000000000001', 'ee8368aa-17c4-414e-b062-f5a54a39702b', '5571999887766', 'Lucas Ferreira',    'delivered', 'Olá Lucas, tudo bem? Temos uma promoção especial de Páscoa pra você! 🐣 Acesse nosso site e confira.',   '2026-03-29 10:22:15+00', '2026-03-29 10:22:18+00', '2026-03-29 10:22:00+00'),
('c0000001-0000-0000-0000-000000000001', 'ed1c61fd-6723-486a-a3a9-2008ae112280', '5521977665544', 'Mariana Silva',     'read',      'Oi Mariana, tudo bem? Temos uma promoção especial de Páscoa pra você! 🐣 Acesse nosso site e confira.',  '2026-03-29 10:26:40+00', '2026-03-29 10:26:43+00', '2026-03-29 10:26:00+00'),
('c0000001-0000-0000-0000-000000000001', '38008233-90c0-4f8c-8f8e-01ff57b7af8d', '5511933445566', 'Patrícia Lima',     'delivered', 'Olá Patrícia, tudo bem? Temos uma promoção especial de Páscoa pra você! 🐣 Acesse nosso site e confira.','2026-03-29 10:31:00+00', '2026-03-29 10:31:03+00', '2026-03-29 10:31:00+00'),
('c0000001-0000-0000-0000-000000000001', '4fb2e301-2039-4207-8e5f-c41f127d5861', '5521966554433', 'Pedro Oliveira',    'failed',    NULL, NULL, NULL, '2026-03-29 10:35:00+00');

-- Adicionar erro nas mensagens com falha
UPDATE campaign_messages SET error_message = 'Número inválido ou bloqueado', failed_at = '2026-03-29 10:14:05+00'
WHERE campaign_id = 'c0000001-0000-0000-0000-000000000001' AND contact_name = 'Fernando Torres';

UPDATE campaign_messages SET error_message = 'Contato na blacklist', failed_at = '2026-03-29 10:35:05+00'
WHERE campaign_id = 'c0000001-0000-0000-0000-000000000001' AND contact_name = 'Pedro Oliveira';

-- ═══════════════════════════════════════════════
-- Logs da campanha 2 (running) - 10 mensagens (6 enviadas, 4 pendentes)
-- ═══════════════════════════════════════════════

INSERT INTO campaign_messages (campaign_id, contact_id, phone, contact_name, status, message_rendered, sent_at, delivered_at, created_at) VALUES
('c0000002-0000-0000-0000-000000000002', '2e893ab9-7a59-496c-800e-280fcdea18bc', '5541988223344', 'Ana Costa',         'delivered', 'Oi Ana, aqui é da Obsidian MSGR. Vimos que você demonstrou interesse nos nossos serviços. Podemos conversar?',      '2026-03-30 14:00:20+00', '2026-03-30 14:00:23+00', '2026-03-30 14:00:00+00'),
('c0000002-0000-0000-0000-000000000002', 'a95a58b8-5eaa-4158-8667-cbfd430f5767', '5531988997766', 'Beatriz Almeida',   'delivered', 'Oi Beatriz, aqui é da Obsidian MSGR. Vimos que você demonstrou interesse nos nossos serviços. Podemos conversar?',  '2026-03-30 14:04:35+00', '2026-03-30 14:04:38+00', '2026-03-30 14:04:00+00'),
('c0000002-0000-0000-0000-000000000002', '4dfe6dfe-f36d-4b8b-80f9-21b891c874db', '5561977665544', 'Camila Nascimento', 'read',      'Oi Camila, aqui é da Obsidian MSGR. Vimos que você demonstrou interesse nos nossos serviços. Podemos conversar?',   '2026-03-30 14:08:10+00', '2026-03-30 14:08:13+00', '2026-03-30 14:08:00+00'),
('c0000002-0000-0000-0000-000000000002', 'cfd3ef09-ed69-4ef0-9824-4335d58ceed4', '5531977665544', 'Carlos Mendes',     'failed',    NULL, NULL, NULL, '2026-03-30 14:12:00+00'),
('c0000002-0000-0000-0000-000000000002', '6fd8a8c3-e416-45b6-b83a-a9cd1897dcad', '5531999112233', 'Fernando Torres',   'delivered', 'Oi Fernando, aqui é da Obsidian MSGR. Vimos que você demonstrou interesse nos nossos serviços. Podemos conversar?', '2026-03-30 14:16:45+00', '2026-03-30 14:16:48+00', '2026-03-30 14:16:00+00'),
('c0000002-0000-0000-0000-000000000002', '07b8697a-7add-4d82-ba51-72d02f12807b', '5511944332211', 'Juliana Rocha',     'sent',      'Oi Juliana, aqui é da Obsidian MSGR. Vimos que você demonstrou interesse nos nossos serviços. Podemos conversar?',  '2026-03-30 14:21:00+00', NULL, '2026-03-30 14:21:00+00'),
('c0000002-0000-0000-0000-000000000002', 'ee8368aa-17c4-414e-b062-f5a54a39702b', '5571999887766', 'Lucas Ferreira',    'sending',   NULL, NULL, NULL, '2026-03-30 14:25:00+00'),
('c0000002-0000-0000-0000-000000000002', 'ed1c61fd-6723-486a-a3a9-2008ae112280', '5521977665544', 'Mariana Silva',     'pending',   NULL, NULL, NULL, '2026-03-30 14:00:00+00'),
('c0000002-0000-0000-0000-000000000002', '38008233-90c0-4f8c-8f8e-01ff57b7af8d', '5511933445566', 'Patrícia Lima',     'pending',   NULL, NULL, NULL, '2026-03-30 14:00:00+00'),
('c0000002-0000-0000-0000-000000000002', '4fb2e301-2039-4207-8e5f-c41f127d5861', '5521966554433', 'Pedro Oliveira',    'pending',   NULL, NULL, NULL, '2026-03-30 14:00:00+00');

UPDATE campaign_messages SET error_message = 'Timeout na API Uzapi', failed_at = '2026-03-30 14:12:08+00'
WHERE campaign_id = 'c0000002-0000-0000-0000-000000000002' AND contact_name = 'Carlos Mendes';

-- ═══════════════════════════════════════════════
-- Logs da campanha 3 (draft) - 10 mensagens pendentes
-- ═══════════════════════════════════════════════

INSERT INTO campaign_messages (campaign_id, contact_id, phone, contact_name, status, created_at) VALUES
('c0000003-0000-0000-0000-000000000003', '2e893ab9-7a59-496c-800e-280fcdea18bc', '5541988223344', 'Ana Costa',         'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', 'a95a58b8-5eaa-4158-8667-cbfd430f5767', '5531988997766', 'Beatriz Almeida',   'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', '4dfe6dfe-f36d-4b8b-80f9-21b891c874db', '5561977665544', 'Camila Nascimento', 'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', 'cfd3ef09-ed69-4ef0-9824-4335d58ceed4', '5531977665544', 'Carlos Mendes',     'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', '6fd8a8c3-e416-45b6-b83a-a9cd1897dcad', '5531999112233', 'Fernando Torres',   'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', '07b8697a-7add-4d82-ba51-72d02f12807b', '5511944332211', 'Juliana Rocha',     'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', 'ee8368aa-17c4-414e-b062-f5a54a39702b', '5571999887766', 'Lucas Ferreira',    'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', 'ed1c61fd-6723-486a-a3a9-2008ae112280', '5521977665544', 'Mariana Silva',     'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', '38008233-90c0-4f8c-8f8e-01ff57b7af8d', '5511933445566', 'Patrícia Lima',     'pending', '2026-03-30 16:00:00+00'),
('c0000003-0000-0000-0000-000000000003', '4fb2e301-2039-4207-8e5f-c41f127d5861', '5521966554433', 'Pedro Oliveira',    'pending', '2026-03-30 16:00:00+00');
