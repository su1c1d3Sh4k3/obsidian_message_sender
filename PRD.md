# PRD - Disparador de Mensagens WhatsApp

> **Versão:** 1.0 (MVP)
> **Data:** 2026-03-30
> **Status:** Em definição

---

## 1. Visão Geral

Sistema multi-tenant de gestão de contatos e disparo de mensagens via WhatsApp, integrado com a API da **Uzapi** para envio e com **Supabase** (PostgreSQL) como banco de dados. O sistema permite importar bases de contatos, organizá-los em listas/tags, criar campanhas de envio (texto, imagem, áudio, vídeo, documento) com agendamento, e acompanhar o progresso em tempo real.

### 1.1. Problema

Empresas que precisam enviar mensagens em massa via WhatsApp enfrentam:
- Bases de contatos despadronizadas (números com/sem DDI, nomes sujos, dados incompletos)
- Risco de banimento por envio sem delay ou sem variação de texto
- Falta de controle sobre entregas, falhas e opt-out (LGPD)
- Ausência de sistema centralizado para múltiplos remetentes

### 1.2. Solução

Plataforma web que automatiza o ciclo completo:
**Importar Contatos → Sanitizar → Organizar em Listas/Tags → Conectar Remetentes (Uzapi) → Criar Campanha → Disparar com Delay Inteligente → Monitorar em Tempo Real → Respeitar Opt-out**

---

## 2. Público-Alvo

- Empresas de marketing e comunicação política
- Agências que gerenciam múltiplos clientes
- Times comerciais que fazem prospecção via WhatsApp

---

## 3. Integrações Externas

| Serviço | Uso | Tipo |
|---------|-----|------|
| **Uzapi** | API de envio/recebimento de mensagens WhatsApp | Principal - Motor de envio |
| **Supabase** | Banco de dados PostgreSQL + Auth + Realtime + Storage | Infraestrutura core |
| **N8N** | Orquestração de fluxos auxiliares (webhooks, automações) | Opcional / Fallback |

### 3.1. Uzapi - Detalhes de Integração

A Uzapi será responsável por:
- **Conexão de instâncias** (cada número remetente = 1 instância)
- **Envio de mensagens**: texto, imagem, áudio, vídeo, documento, localização, contato
- **Recebimento de webhooks**: status de entrega, mensagens recebidas (para opt-out)
- **Status de conexão**: verificar se a instância está online/offline

> **Nota:** Toda a documentação da API Uzapi e chaves já estão disponíveis.

### 3.2. N8N - Detalhes de Integração

O N8N será utilizado como camada de orquestração quando necessário:
- Processamento de webhooks da Uzapi (delivery reports, mensagens de opt-out)
- Fluxos auxiliares de automação (ex: notificação ao admin quando campanha finaliza)
- Retry de mensagens com falha
- Pode ser substituído por workers nativos do back-end se preferível

---

## 4. Arquitetura Técnica

### 4.1. Stack

| Camada | Tecnologia |
|--------|-----------|
| **Front-end** | React.js + TypeScript + Tailwind CSS + TanStack Table |
| **Back-end** | Node.js + TypeScript (Express ou Fastify) |
| **Banco de Dados** | Supabase (PostgreSQL) |
| **Autenticação** | Supabase Auth (email/senha) |
| **Realtime** | Supabase Realtime (WebSocket nativo) |
| **Storage** | Supabase Storage (mídias: imagens, áudios, vídeos, docs) |
| **Filas** | pg_boss (filas nativas no PostgreSQL via Supabase) ou BullMQ + Redis |
| **Hospedagem** | VPS própria |

### 4.2. Diagrama de Arquitetura (Simplificado)

```
┌─────────────────────────────────────────────────────┐
│                    FRONT-END (React)                │
│  Login │ Contatos │ Campanhas │ Dashboard │ Config  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / WebSocket
                       ▼
┌─────────────────────────────────────────────────────┐
│                   BACK-END (Node.js)                │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ API REST │  │ Workers  │  │ Scheduler (CRON)  │ │
│  │ (CRUD)   │  │ (Filas)  │  │ (Agendamentos)    │ │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘ │
└───────┼──────────────┼─────────────────┼────────────┘
        │              │                 │
        ▼              ▼                 ▼
┌───────────────┐ ┌─────────┐  ┌──────────────────┐
│   Supabase    │ │  Uzapi  │  │   N8N (opcional)  │
│  PostgreSQL   │ │  API    │  │   Webhooks/Flows  │
│  Auth/Storage │ │  WhatsApp│  │                   │
└───────────────┘ └─────────┘  └──────────────────┘
```

---

## 5. Modelagem do Banco de Dados (Supabase/PostgreSQL)

### 5.1. Diagrama Entidade-Relacionamento

```
tenants ─┬── users
         ├── contacts ──── contact_tags (N:N) ──── tags
         ├── lists ──── list_contacts (N:N) ──── contacts
         ├── senders (instâncias Uzapi)
         ├── campaigns ──┬── campaign_messages (logs)
         │               └── campaign_media
         ├── blacklist
         └── import_jobs
```

### 5.2. Tabelas

#### `tenants` — Empresas/Organizações
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `users` — Usuários do sistema
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `contacts` — Contatos (coração do sistema)
```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255), -- nome sanitizado para exibição
    phone VARCHAR(20) NOT NULL, -- apenas números, com DDI+DDD (ex: 5531999999999)
    phone_raw VARCHAR(50), -- número original antes da sanitização
    email VARCHAR(255),
    organization VARCHAR(255),
    organization_title VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(10),
    address TEXT,
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    is_valid BOOLEAN DEFAULT true, -- número validado
    is_blacklisted BOOLEAN DEFAULT false, -- opt-out
    source VARCHAR(100) DEFAULT 'manual', -- 'import', 'manual', 'api'
    import_job_id UUID REFERENCES import_jobs(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON contacts(tenant_id, phone);
CREATE INDEX idx_contacts_city ON contacts(tenant_id, city);
CREATE INDEX idx_contacts_blacklisted ON contacts(tenant_id, is_blacklisted) WHERE is_blacklisted = true;
```

#### `tags` — Tags para segmentação
```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6', -- hex color
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);
```

#### `contact_tags` — Relação N:N contatos ↔ tags
```sql
CREATE TABLE contact_tags (
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);
```

#### `lists` — Listas/Grupos de contatos
```sql
CREATE TABLE lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    contact_count INT DEFAULT 0, -- cache counter
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `list_contacts` — Relação N:N listas ↔ contatos
```sql
CREATE TABLE list_contacts (
    list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (list_id, contact_id)
);
```

#### `senders` — Números remetentes (instâncias Uzapi)
```sql
CREATE TABLE senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- nome amigável (ex: "Comercial 1")
    phone VARCHAR(20) NOT NULL, -- número do remetente
    uzapi_instance_id VARCHAR(255) NOT NULL, -- ID da instância na Uzapi
    uzapi_token VARCHAR(500) NOT NULL, -- token da instância
    uzapi_url VARCHAR(500) NOT NULL, -- URL base da API Uzapi
    status VARCHAR(50) DEFAULT 'disconnected', -- 'connected', 'disconnected', 'banned', 'qr_pending'
    last_seen_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}', -- config específica (ex: delay min/max)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `campaigns` — Campanhas de disparo
```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    -- status: 'draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed'

    -- Público-alvo (um ou outro)
    target_type VARCHAR(20) NOT NULL, -- 'list', 'tag', 'filter'
    target_list_id UUID REFERENCES lists(id),
    target_tag_id UUID REFERENCES tags(id),
    target_filter JSONB, -- filtro dinâmico (ex: {"city": "Belo Horizonte"})

    -- Mensagem
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'audio', 'video', 'document'
    message_body TEXT NOT NULL, -- suporta variáveis {{nome}}, {{cidade}} e spintax {Olá|Oi}
    media_url TEXT, -- URL do arquivo no Supabase Storage
    media_filename VARCHAR(255),
    media_caption TEXT, -- legenda para imagem/vídeo/documento

    -- Configurações de envio
    sender_id UUID REFERENCES senders(id), -- NULL = distribuir entre vários
    sender_ids UUID[], -- array de senders para round-robin
    delay_min INT DEFAULT 15, -- delay mínimo entre mensagens (segundos)
    delay_max INT DEFAULT 45, -- delay máximo entre mensagens (segundos)
    daily_limit INT, -- limite de envios por dia (NULL = sem limite)
    use_spintax BOOLEAN DEFAULT false,

    -- Agendamento
    scheduled_at TIMESTAMPTZ, -- NULL = enviar agora
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Contadores (cache)
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
```

#### `campaign_messages` — Log de cada mensagem enviada
```sql
CREATE TABLE campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id),
    sender_id UUID REFERENCES senders(id),
    phone VARCHAR(20) NOT NULL,
    contact_name VARCHAR(255),

    status VARCHAR(50) DEFAULT 'pending',
    -- status: 'pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped'

    message_rendered TEXT, -- mensagem final (com variáveis e spintax resolvidos)
    error_message TEXT, -- motivo do erro se falhou
    uzapi_message_id VARCHAR(255), -- ID retornado pela Uzapi

    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cm_campaign ON campaign_messages(campaign_id);
CREATE INDEX idx_cm_status ON campaign_messages(campaign_id, status);
CREATE INDEX idx_cm_contact ON campaign_messages(contact_id);
```

#### `blacklist` — Números que pediram opt-out (LGPD)
```sql
CREATE TABLE blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    reason VARCHAR(255) DEFAULT 'opt-out', -- 'opt-out', 'manual', 'bounce', 'invalid'
    source VARCHAR(100), -- de onde veio o opt-out (ex: campanha X, manual)
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, phone)
);
```

#### `import_jobs` — Controle de importações de planilhas
```sql
CREATE TABLE import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    file_url TEXT, -- URL no Supabase Storage
    status VARCHAR(50) DEFAULT 'pending',
    -- status: 'pending', 'processing', 'completed', 'failed'

    total_rows INT DEFAULT 0,
    imported_count INT DEFAULT 0,
    skipped_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    errors JSONB DEFAULT '[]', -- lista de erros [{row: 5, error: "telefone inválido"}]

    column_mapping JSONB, -- mapeamento de colunas do CSV para campos do sistema
    auto_tag_id UUID REFERENCES tags(id), -- tag automática para contatos importados
    auto_list_id UUID REFERENCES lists(id), -- lista automática

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3. Row Level Security (RLS)

Todas as tabelas terão **RLS habilitado** no Supabase para garantir isolamento multi-tenant:

```sql
-- Exemplo para contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON contacts
    USING (tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
    ));
```

> **Regra geral:** Todo SELECT, INSERT, UPDATE e DELETE é filtrado pelo `tenant_id` do usuário autenticado.

---

## 6. Funcionalidades do MVP

### 6.1. Tela: Login e Registro

- Login com email/senha (Supabase Auth)
- Registro de novo tenant (cria empresa + primeiro usuário como `owner`)
- Reset de senha
- Redirect para dashboard após login

### 6.2. Tela: Dashboard Principal

- Resumo rápido:
  - Total de contatos
  - Campanhas ativas/agendadas
  - Mensagens enviadas hoje
  - Status dos remetentes (conectados/desconectados)
- Lista das últimas campanhas com status
- Gráfico simples de envios nos últimos 7 dias

### 6.3. Tela: Gestão de Contatos

#### 6.3.1. Listagem
- Tabela paginada com TanStack Table (server-side pagination)
- Colunas: Nome, Telefone, Cidade, Estado, Organização, Tags, Status, Data de cadastro
- Busca global (nome, telefone, organização)
- Filtros: por cidade, estado, tag, lista, status (válido/inválido), blacklist
- Ordenação por qualquer coluna

#### 6.3.2. Ações em Massa
- Selecionar múltiplos contatos (checkbox)
- Atribuir tag
- Adicionar a uma lista
- Remover da lista
- Adicionar à blacklist
- Excluir

#### 6.3.3. Importação (Upload CSV/XLSX)
- Upload de arquivo CSV ou Excel
- Preview das primeiras 10 linhas
- Mapeamento de colunas: o usuário associa cada coluna do arquivo a um campo do sistema
- **Sanitização automática de telefones:**
  - Remove espaços, traços, parênteses, pontos
  - Remove prefixo `+`
  - Adiciona DDI `55` se ausente
  - Valida formato (mínimo 12 dígitos com DDI+DDD+número)
  - Marca como inválido se não atender
- **Sanitização de nomes:**
  - Remove emojis e caracteres especiais
  - Trim de espaços
  - Capitalização (primeira letra maiúscula)
  - Extrai apelido/organização entre parênteses para campo separado
- Opção de auto-tagging: atribuir tag automaticamente aos importados
- Opção de auto-list: adicionar a uma lista automaticamente
- Barra de progresso durante importação
- Relatório final: X importados, Y ignorados (duplicados), Z erros

#### 6.3.4. Cadastro/Edição Manual
- Formulário para adicionar contato individual
- Edição inline ou via modal

#### 6.3.5. Tags e Listas
- CRUD de tags (nome + cor)
- CRUD de listas (nome + descrição)
- Visualização de contatos por tag ou lista

### 6.4. Tela: Remetentes (Conexão WhatsApp)

- Lista de instâncias Uzapi cadastradas
- Para cada remetente:
  - Nome amigável
  - Número de telefone
  - Status de conexão (badge: verde/vermelho/amarelo)
  - Configurações da instância Uzapi (instance_id, token, URL)
- Botão "Verificar Conexão" (chama API Uzapi para checar status)
- Botão "Gerar QR Code" (quando desconectado, usa endpoint Uzapi)
- Modal com QR Code para o usuário escanear
- Configurações por remetente: delay mín/máx padrão

### 6.5. Tela: Campanhas

#### 6.5.1. Listagem
- Tabela com campanhas: Nome, Status, Público, Progresso, Data de criação, Agendamento
- Filtro por status
- Ações: Visualizar, Editar (se draft), Pausar, Retomar, Cancelar, Duplicar

#### 6.5.2. Criação de Nova Campanha (Wizard/Steps)

**Step 1 - Informações básicas:**
- Nome da campanha
- Seleção do público-alvo:
  - Por Lista
  - Por Tag
  - Por Filtro dinâmico (cidade, estado, etc.)
- Preview: "X contatos serão alcançados"

**Step 2 - Mensagem:**
- Tipo: Texto / Imagem / Áudio / Vídeo / Documento
- Editor de texto com:
  - Variáveis disponíveis: `{{nome}}`, `{{primeiro_nome}}`, `{{cidade}}`, `{{organizacao}}`
  - Suporte a Spintax: `{Olá|Oi|E aí}` — o sistema sorteia uma variação por mensagem
  - Preview da mensagem com dados de um contato exemplo
- Upload de mídia (se tipo != texto):
  - Imagem: JPG, PNG (até 5MB)
  - Áudio: OGG/MP3 (até 16MB) — opção de gravar na hora
  - Vídeo: MP4 (até 16MB)
  - Documento: PDF, DOCX, XLSX (até 100MB)
  - Campo de legenda (caption)

**Step 3 - Configuração de envio:**
- Selecionar remetente(s):
  - Um único remetente
  - Múltiplos (round-robin: distribui mensagens entre os números)
- Delay entre mensagens: slider ou inputs (mín e máx em segundos)
- Limite diário por remetente (opcional)

**Step 4 - Agendamento:**
- "Enviar agora" ou "Agendar para"
- DateTime picker (data + hora)
- Resumo final antes de confirmar

#### 6.5.3. Spintax Engine

O processamento de spintax funciona assim:
```
Input:  "{Olá|Oi|E aí} {{nome}}, {tudo bem|como vai}?"
Output: "Oi João, como vai?"
```
- Cada `{opção1|opção2|opção3}` é resolvido aleatoriamente por mensagem
- Variáveis `{{campo}}` são substituídas pelos dados do contato
- Isso reduz a chance de bloqueio por mensagens idênticas

### 6.6. Tela: Dashboard de Envio (Real-time)

- Ao clicar em uma campanha "running":
  - **Header:** Nome, status, remetente(s), início, tempo decorrido
  - **Barra de progresso:** X/Y mensagens (porcentagem)
  - **Contadores:** Enviadas, Entregues, Lidas, Falhas, Pendentes
  - **Tabela de logs (real-time via Supabase Realtime):**
    - Nome | Telefone | Status | Horário | Erro (se houver)
  - **Ações:** Pausar, Retomar, Cancelar

### 6.7. Tela: Blacklist (LGPD)

- Lista de números bloqueados
- Adicionar manualmente
- Importar lista de blacklist
- **Auto-blacklist:** Quando a Uzapi recebe webhook com resposta contendo palavras-chave:
  - "sair", "parar", "cancelar", "remover", "não quero", "stop", "pare"
  - Configurável pelo tenant (adicionar/remover palavras-chave)
- Contatos na blacklist são automaticamente excluídos de qualquer campanha

### 6.8. Tela: Configurações

- Dados da empresa (tenant)
- Gerenciamento de usuários (convidar, alterar role, desativar)
- Palavras-chave de opt-out
- Configurações padrão de delay
- Webhook URL para N8N (se utilizado)

---

## 7. Motor de Envio (Worker)

### 7.1. Fluxo de Processamento

```
1. Campanha criada com status 'draft'
2. Usuário confirma → status = 'scheduled' (ou 'running' se "enviar agora")
3. Scheduler (CRON) verifica a cada minuto campanhas com scheduled_at <= NOW()
4. Para cada campanha pronta:
   a. Gera registros em campaign_messages (1 por contato, status = 'pending')
   b. Exclui contatos da blacklist (status = 'skipped')
   c. Altera campanha para 'running'
5. Worker consome campaign_messages com status = 'pending':
   a. Resolve spintax e variáveis
   b. Escolhe remetente (round-robin se múltiplos)
   c. Chama API Uzapi para enviar
   d. Atualiza status da mensagem ('sent' ou 'failed')
   e. Aguarda delay aleatório (entre delay_min e delay_max)
   f. Atualiza contadores da campanha
6. Quando todas as mensagens foram processadas → status = 'completed'
```

### 7.2. Regras Anti-Ban

| Regra | Implementação |
|-------|--------------|
| Delay aleatório | `delay_min` a `delay_max` segundos entre cada envio (padrão: 15-45s) |
| Variação de texto | Spintax obrigatório recomendado |
| Limite diário | Máximo de envios por remetente/dia (configurável, sugestão: 200-500) |
| Round-robin | Distribuir envios entre múltiplos remetentes |
| Pausa noturna | Não enviar entre 20h e 8h (configurável) |
| Warm-up | Novos números começam com limite menor (50/dia) e sobem gradualmente |

### 7.3. Tratamento de Erros

- **Número inválido:** Marca contato como `is_valid = false`, mensagem como `failed`
- **Instância desconectada:** Pausa a campanha, notifica o usuário
- **Rate limit da API:** Aumenta o delay automaticamente, retry com backoff
- **Erro genérico:** Registra no log, tenta próximo contato, não trava a fila

---

## 8. Sanitizador de Dados

Módulo crítico que roda na importação e no cadastro manual.

### 8.1. Sanitização de Telefone

```typescript
function sanitizePhone(raw: string): { phone: string; isValid: boolean } {
    // 1. Remove tudo que não é número
    let clean = raw.replace(/\D/g, '');

    // 2. Remove zero à esquerda
    if (clean.startsWith('0')) clean = clean.substring(1);

    // 3. Adiciona DDI 55 se não tem
    if (!clean.startsWith('55') && clean.length <= 11) {
        clean = '55' + clean;
    }

    // 4. Valida: DDI(2) + DDD(2) + Número(8-9) = 12-13 dígitos
    const isValid = /^55\d{10,11}$/.test(clean);

    return { phone: clean, isValid };
}
```

### 8.2. Sanitização de Nome

```typescript
function sanitizeName(raw: string): { displayName: string; orgExtracted?: string } {
    // 1. Remove emojis
    let name = raw.replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

    // 2. Extrai texto entre parênteses como organização
    const orgMatch = name.match(/\(([^)]+)\)/);
    const orgExtracted = orgMatch ? orgMatch[1].trim() : undefined;
    name = name.replace(/\([^)]*\)/g, '');

    // 3. Remove caracteres especiais do início
    name = name.replace(/^[^a-zA-ZÀ-ú]+/, '');

    // 4. Trim e capitaliza
    name = name.trim().replace(/\b\w/g, c => c.toUpperCase());

    return { displayName: name || 'Sem Nome', orgExtracted };
}
```

---

## 9. Dados Base (Importação Inicial)

O sistema já possui uma planilha base (`dados_sanitizados.xlsx`) com **~13.851 contatos** contendo:

| Coluna Original | Campo no Sistema |
|-----------------|-----------------|
| First Name | `first_name` |
| Middle Name | (concatenar com first_name ou ignorar) |
| Last Name | `last_name` |
| Organization Name | `organization` |
| Organization Title | `organization_title` |
| numeros sanitizados | `phone` (aplicar sanitização adicional) |
| Address 1 - Formatted | `city` + `state` (parsear "Belo Horizonte, MG") |

> **Atenção:** Apesar do nome "dados_sanitizados", os dados ainda precisam de sanitização adicional (emojis em nomes, números sem DDI, caracteres especiais).

---

## 10. Requisitos Não-Funcionais

| Requisito | Meta |
|-----------|------|
| **Performance** | Tabela de contatos deve carregar em < 2s com paginação server-side |
| **Escalabilidade** | Suportar 50.000+ contatos por tenant |
| **Disponibilidade** | Sistema disponível 99%+ (VPS com PM2/Docker) |
| **Segurança** | RLS no Supabase, tokens Uzapi encriptados, HTTPS obrigatório |
| **LGPD** | Blacklist respeitada em 100% dos envios, opt-out automático |
| **Realtime** | Dashboard atualiza em < 3s após cada envio |

---

## 11. Roadmap de Desenvolvimento

### Fase 1 — Infraestrutura e Dados (Semana 1-2)
- [ ] Setup do projeto (React + Node.js + TypeScript)
- [ ] Configurar Supabase (banco, auth, storage, RLS)
- [ ] Modelagem e criação das tabelas
- [ ] Sistema de autenticação (login, registro, multi-tenant)
- [ ] Tela de gestão de contatos (CRUD, listagem, filtros)
- [ ] Importação de CSV/XLSX com sanitização
- [ ] Importar a planilha base de 13.851 contatos

### Fase 2 — Motor de Envio (Semana 3-4)
- [ ] Integração com API Uzapi (conexão, status, envio)
- [ ] Tela de remetentes (cadastro de instâncias, verificação de status)
- [ ] Worker de processamento de fila (pg_boss ou BullMQ)
- [ ] Lógica de delay aleatório e round-robin
- [ ] Processamento de webhooks (delivery reports)

### Fase 3 — Campanhas (Semana 5)
- [ ] Tela de criação de campanha (wizard 4 steps)
- [ ] Engine de spintax e variáveis
- [ ] Seleção de público por lista/tag/filtro
- [ ] Upload de mídia (Supabase Storage)
- [ ] Integrar campanha com motor de envio

### Fase 4 — Agendamento e Real-time (Semana 6)
- [ ] Scheduler (CRON) para campanhas agendadas
- [ ] Dashboard real-time (Supabase Realtime)
- [ ] Barra de progresso e logs ao vivo
- [ ] Ações de pausar/retomar/cancelar
- [ ] Notificações (campanha concluída, remetente desconectou)

### Fase 5 — LGPD e Polimento (Semana 7)
- [ ] Blacklist e auto opt-out por webhook
- [ ] Tela de configurações
- [ ] Dashboard principal com resumo
- [ ] Testes e correção de bugs
- [ ] Deploy na VPS

### Fase 6 — Extras (Pós-MVP)
- [ ] Calendário visual de campanhas
- [ ] Templates de mensagens reutilizáveis
- [ ] Relatórios exportáveis (PDF/CSV)
- [ ] Warm-up automático de números novos
- [ ] Integração N8N para fluxos customizados
- [ ] Chatbot de respostas automáticas
- [ ] API pública para integrações de terceiros

---

## 12. Métricas de Sucesso do MVP

| Métrica | Critério |
|---------|---------|
| Importação funcional | Importar 13.851 contatos com < 5% de erro |
| Envio funcional | Campanha de 100 mensagens sem ban |
| Delay respeitado | 100% dos envios com delay entre mín/máx |
| Blacklist respeitada | 0 mensagens enviadas para números na blacklist |
| Multi-tenant | 2+ tenants operando isoladamente |
| Real-time | Dashboard reflete envios em < 3s |

---

## 13. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Banimento de número | Alto | Delay, spintax, round-robin, warm-up, limites diários |
| API Uzapi instável | Médio | Retry com backoff, fallback via N8N, logs detalhados |
| Dados sujos na importação | Médio | Sanitizador robusto, preview antes de confirmar, relatório de erros |
| Limite do Supabase (free tier) | Baixo | Monitorar uso, migrar para tier pago se necessário |
| LGPD / Reclamações | Alto | Opt-out automático, blacklist obrigatória, logs de consentimento |

---

> **Próximo passo:** Iniciar a Fase 1 — Setup do projeto e modelagem do banco no Supabase.
