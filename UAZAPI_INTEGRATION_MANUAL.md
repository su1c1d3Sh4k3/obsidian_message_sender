# Manual Técnico: Integração com a API Uazapi (WhatsApp Gateway)

**Versão:** 1.0
**Data:** 2026-03-30
**Projeto:** Clinvia
**Stack:** React 18 + TypeScript + Supabase Edge Functions (Deno)

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Variáveis de Ambiente e Credenciais](#2-variáveis-de-ambiente-e-credenciais)
3. [Banco de Dados: Tabela `instances`](#3-banco-de-dados-tabela-instances)
4. [Ciclo de Vida de uma Instância](#4-ciclo-de-vida-de-uma-instância)
5. [Fase 1 — Criação da Instância](#5-fase-1--criação-da-instância)
6. [Fase 2 — Conexão (Pair Code)](#6-fase-2--conexão-pair-code)
7. [Fase 3 — Verificação de Status (Polling)](#7-fase-3--verificação-de-status-polling)
8. [Fase 4 — Instância em Uso](#8-fase-4--instância-em-uso)
9. [Fase 5 — Exclusão da Instância](#9-fase-5--exclusão-da-instância)
10. [Arquitetura de Webhook com Fila](#10-arquitetura-de-webhook-com-fila)
11. [Frontend: Connections.tsx](#11-frontend-connectionstsx)
12. [Frontend: InstanceRow.tsx](#12-frontend-instancerowtsx)
13. [Cliente Frontend: uzapi.ts](#13-cliente-frontend-uzapits)
14. [Referência Completa das APIs Uazapi](#14-referência-completa-das-apis-uazapi)
15. [Fluxo Completo End-to-End](#15-fluxo-completo-end-to-end)
16. [Guia para Replicar o Sistema](#16-guia-para-replicar-o-sistema)

---

## 1. Visão Geral da Arquitetura

O sistema usa a **Uazapi** como gateway WhatsApp. Cada instância Uazapi representa uma conexão WhatsApp independente (um número de telefone). O frontend nunca chama a Uazapi diretamente em operações críticas — todas as operações de ciclo de vida passam por **Supabase Edge Functions** (Deno), que atuam como proxy seguro.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  src/pages/Connections.tsx       src/components/InstanceRow.tsx │
│  src/lib/uzapi.ts (cliente direto para ações secundárias)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │  supabase.functions.invoke(...)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SUPABASE EDGE FUNCTIONS (Deno)                 │
│  uzapi-create-instance    →  POST /instance/init                │
│  uzapi-connect-instance   →  POST /webhook + POST /instance/connect │
│  uzapi-manager            →  GET /instance/status (check)       │
│  uzapi-delete-instance    →  DELETE /instance                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTPS REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   UAZAPI (WhatsApp Gateway)                     │
│               https://clinvia.uazapi.com                        │
└─────────────────────────────────────────────────────────────────┘

WEBHOOK REVERSO (Uazapi → Clinvia):
┌────────────────────────────┐       ┌──────────────────────────────┐
│   Uazapi (evento WA)       │──────▶│  webhook-queue-receiver      │
│   POST → Supabase func URL │       │  (responde 200 imediatamente)│
└────────────────────────────┘       └────────────┬─────────────────┘
                                                  │  insert webhook_queue
                                                  │  invoke webhook-queue-processor
                                                  ▼
                                     ┌──────────────────────────────┐
                                     │  webhook-queue-processor     │
                                     │  (roteamento atômico em lote)│
                                     └──────────────────────────────┘
```

---

## 2. Variáveis de Ambiente e Credenciais

### Uazapi

| Variável | Valor | Onde é Usada |
|----------|-------|--------------|
| `UZAPI_URL` | `https://clinvia.uazapi.com` | Todas as Edge Functions e uzapi.ts |
| `UZAPI_ADMIN_TOKEN` | `6EiMFTZGDpLxaP5u1pD2oXpzTjwL5B73WEdcCfjOIRYsTlGx1l` | Apenas na criação de instâncias (`/instance/init`) |

**Importante:** O `admintoken` é um token global do servidor Uazapi. Cada instância criada recebe seu próprio token (`apikey`) que é salvo no banco e usado nas operações subsequentes.

### Supabase Edge Functions

| Variável Deno | Origem |
|---------------|--------|
| `SUPABASE_URL` | Auto-injetado pelo Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injetado pelo Supabase runtime |

### Webhook Receiver URL

```
https://swfshqvvbohnahdyndch.supabase.co/functions/v1/webhook-queue-receiver
```

Esta URL é configurada na Uazapi durante a conexão da instância, para onde a Uazapi enviará todos os eventos WhatsApp.

---

## 3. Banco de Dados: Tabela `instances`

```sql
-- Estrutura principal
instances (
    id                      UUID PRIMARY KEY,
    name                    TEXT NOT NULL UNIQUE,       -- Nome sanitizado da instância
    instance_name           TEXT,                       -- Nome retornado pela Uazapi
    server_url              TEXT,                       -- https://clinvia.uazapi.com
    apikey                  TEXT,                       -- Token único da instância (retornado no init)
    status                  TEXT,                       -- 'disconnected' | 'connecting' | 'connected'
    qr_code                 TEXT,                       -- Base64 do QR (quando disponível)
    pin_code                TEXT,                       -- Código de pareamento de 8 dígitos
    client_number           TEXT,                       -- Número de telefone do WhatsApp conectado
    user_name               TEXT,                       -- Nome do perfil WhatsApp
    profile_pic_url         TEXT,                       -- URL da foto de perfil (armazenada no Supabase Storage)
    webhook_url             TEXT,                       -- URL do webhook externo (n8n / webhooks.clinvia.com.br)
    default_queue_id        UUID REFERENCES queues(id), -- Fila padrão para conversas recebidas
    auto_create_deal_funnel_id UUID REFERENCES crm_funnels(id), -- Funil para criação automática de deals
    user_id                 UUID NOT NULL REFERENCES profiles(id), -- Tenant owner
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ
)
```

---

## 4. Ciclo de Vida de uma Instância

```
[ADMIN] Digita nome → Clica "Criar"
         │
         ▼
[1] uzapi-create-instance
    ├── Verifica nome duplicado no DB
    ├── POST /instance/init (admintoken)
    ├── Recebe token da instância
    ├── Busca/cria fila padrão "Atendimento Humano"
    └── Insere na tabela instances (status: 'disconnected')
         │
         ▼
[2] ConnectInstanceDialog abre automaticamente
    Usuário digita número de telefone → Clica "Gerar Código"
         │
         ▼
[3] uzapi-connect-instance
    ├── Busca token da instância no DB
    ├── POST /webhook (configura webhook → Supabase receiver)
    ├── POST /instance/connect (phone) → recebe pair code 8 dígitos
    └── Atualiza instances (pin_code, client_number, status: 'connecting')
         │
         ▼
[4] Frontend exibe pin_code em formato "XXXX-XXXX"
    Usuário vai no WhatsApp → Aparelhos vinculados → Vincular com código
         │
         ▼
[5] POLLING: useEffect + useQuery a cada 3-5s
    ├── supabase.functions.invoke('uzapi-manager', {action:'check_connection'})
    ├── GET /instance/status via Uazapi
    ├── Atualiza DB com novo status + profilePic
    └── Quando status = 'connected' → fecha dialog, toast de sucesso
         │
         ▼
[6] INSTÂNCIA ATIVA
    ├── Uazapi envia eventos via webhook → webhook-queue-receiver
    ├── Processamento assíncrono via webhook-queue-processor
    └── Mensagens, status de leitura, etc.
         │
         ▼
[7] Exclusão (opcional)
    ├── DELETE /instance via Uazapi
    └── DELETE da tabela instances no DB
```

---

## 5. Fase 1 — Criação da Instância

### Edge Function: `uzapi-create-instance`

**Trigger:** `supabase.functions.invoke('uzapi-create-instance', { body: { instanceName, userId } })`

**Fluxo detalhado:**

```
1. Recebe: { instanceName: string, userId: string }

2. Sanitiza o nome:
   - Lowercase
   - Espaços → hifens
   - Remove hifens duplicados e nas bordas
   - Exemplo: "Minha Clínica" → "minha-clinica"

3. Valida que nome não está vazio e userId existe

4. DUPLICATA CHECK:
   SELECT id FROM instances WHERE name = sanitizedName
   → Se encontrar: retorna erro "nome já foi usado"
   → Se não encontrar: continua

5. CRIA NA UAZAPI:
   POST https://clinvia.uazapi.com/instance/init
   Headers:
     Content-Type: application/json
     Accept: application/json
     admintoken: 6EiMFTZGDpLxaP5u1pD2oXpzTjwL5B73WEdcCfjOIRYsTlGx1l
   Body:
     { "name": "minha-clinica", "systemName": "apilocal" }

   Resposta esperada:
   {
     "token": "abc123instancetoken...",
     "name": "minha-clinica",
     "instance": { "status": "disconnected", ... },
     "qrcode": null  // ainda não disponível
   }

6. Extrai: token (=apikey), status, name da resposta

7. FILA PADRÃO:
   SELECT id FROM queues WHERE user_id = userId AND name = 'Atendimento Humano'
   → Se não existir: INSERT INTO queues (name='Atendimento Humano', is_active=true, is_default=true)

8. SALVA NO DB:
   INSERT INTO instances:
   {
     name: finalName,
     instance_name: finalName,
     server_url: 'https://clinvia.uazapi.com',
     apikey: token,          ← token único desta instância
     status: 'disconnected',
     webhook_url: 'https://webhooks.clinvia.com.br/webhook/{name}',
     user_id: userId,
     default_queue_id: defaultQueueId
   }

9. Retorna:
   { success: true, id, instanceName, token, status, ...uzapiData }
```

**No Frontend (Connections.tsx):**
```typescript
const createMutation = useMutation({
    mutationFn: async () => {
        const { data, error } = await supabase.functions.invoke(
            "uzapi-create-instance",
            { body: { instanceName: name, userId: user.id } }
        );
        if (!data.success) throw new Error(data.error);
        return data;
    },
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["instances"] });
        setCurrentInstanceName(data.instanceName);
        setSelectedInstanceId(data.id);
        setConnectDialogOpen(true);  // Abre automaticamente o dialog de conexão
    }
});
```

---

## 6. Fase 2 — Conexão (Pair Code)

### Edge Function: `uzapi-connect-instance`

**Trigger:** `supabase.functions.invoke('uzapi-connect-instance', { body: { instanceId, phoneNumber } })`

**Fluxo detalhado:**

```
1. Recebe: { instanceId: string, phoneNumber: string }
   Exemplo phoneNumber: "5511999999999" (com DDI, sem +)

2. Busca token da instância no DB:
   SELECT apikey, name FROM instances WHERE id = instanceId

3. CONFIGURA WEBHOOK PRIMEIRO (antes do pair code):
   POST https://clinvia.uazapi.com/webhook
   Headers:
     Content-Type: application/json
     Accept: application/json
     token: {instanceToken}    ← token da instância (não admintoken!)
   Body:
     {
       "enabled": true,
       "url": "https://swfshqvvbohnahdyndch.supabase.co/functions/v1/webhook-queue-receiver",
       "events": ["messages", "connection", "messages_update"],
       "excludeMessages": ["wasSentByApi"]
     }

   Observação: Se falhar, CONTINUA mesmo assim (não bloqueia o par code)

4. GERA PAR CODE:
   POST https://clinvia.uazapi.com/instance/connect
   Headers:
     Content-Type: application/json
     Accept: application/json
     token: {instanceToken}
   Body:
     { "phone": "5511999999999" }

   Resposta esperada:
   [
     {
       "instance": {
         "paircode": "ABCD1234",   ← código de 8 chars para o usuário digitar
         "status": "connecting",
         "name": "minha-clinica",
         "token": "abc123..."
       }
     }
   ]

   Nota: A resposta pode ser um array — sempre tratar como:
   const responseItem = Array.isArray(data) ? data[0] : data;

5. Extrai pairCode da resposta

6. ATUALIZA DB:
   UPDATE instances SET
     pin_code = pairCode,
     client_number = phoneNumber,
     user_name = phoneNumber,
     status = 'connecting',
     instance_name = instanceName,
     webhook_url = 'https://webhooks.clinvia.com.br/webhook/{name}',
     apikey = token   ← atualiza token se vier novo
   WHERE id = instanceId

7. Retorna:
   { success: true, pairCode: "ABCD1234", status: "connecting", webhookConfigured: true/false }
```

**No Frontend (Connections.tsx):**
```typescript
const connectMutation = useMutation({
    mutationFn: async ({ id, phone }: { id: string, phone: string }) => {
        const { data, error } = await supabase.functions.invoke("uzapi-connect-instance", {
            body: { instanceId: id, phoneNumber: phone }
        });
        if (!data.success) throw new Error(data.error);
        return data;
    },
    onSuccess: (data) => {
        setCurrentPairCode(data.pairCode);     // exibe "ABCD-1234" na UI
        setPollingInstanceId(selectedInstanceId); // inicia polling
    }
});
```

**Exibição do Pair Code na UI:**
O código é exibido formatado: `"ABCD1234"` → `"ABCD-1234"`
O usuário abre WhatsApp > Aparelhos Vinculados > Vincular com número de telefone > digita o código.

---

## 7. Fase 3 — Verificação de Status (Polling)

### Edge Function: `uzapi-manager` (action: `check_connection`)

**Trigger:** `supabase.functions.invoke('uzapi-manager', { body: { action: 'check_connection', instanceId } })`

**Fluxo detalhado:**

```
1. Recebe: { action: 'check_connection', instanceId: string }

2. Busca instância completa no DB (SELECT *)

3. CONSULTA STATUS NA UAZAPI:
   GET https://clinvia.uazapi.com/instance/status
   Headers:
     Accept: application/json
     token: {instance.apikey}

   Resposta esperada:
   {
     "instance": {
       "status": "connected" | "open" | "disconnected" | "connecting",
       "profileName": "Nome do WhatsApp",
       "profilePicUrl": "https://...",
       "name": "minha-clinica"
     },
     "status": {
       "connected": true/false
     }
   }

4. MAPEAMENTO DE STATUS:
   - "connected" ou "open" → "connected"
   - "connecting" → "connecting"
   - qualquer outro → "disconnected"

5. ATUALIZA FOTO DE PERFIL (se mudou):
   - Se profilePicUrl existe e é diferente do DB:
     a. Baixa a imagem via fetch(profilePicUrl)
     b. Faz upload no Supabase Storage bucket 'avatars':
        fileName = '{instanceId}_avatar_{timestamp}.jpg'
     c. Obtém URL pública do Storage
     d. Salva URL pública no campo profile_pic_url

6. ATUALIZA DB:
   UPDATE instances SET
     status = status,
     profile_pic_url = profilePicUrl,
     user_name = profileName || instance.user_name,
     qr_code = (status === 'connected' ? null : instance.qr_code)
   WHERE id = instanceId

7. Retorna:
   { success: true, status: 'connected', profilePicUrl, profileName }
```

**Polling no Frontend:**

O polling é feito via `useEffect` que monitora as mudanças no array `instances` (retornado pelo `useQuery`):

```typescript
// Connections.tsx
useEffect(() => {
    if (pollingInstanceId && instances) {
        const instance = instances.find(i => i.id === pollingInstanceId);
        if (instance && instance.status === 'connected') {
            setConnectDialogOpen(false);   // Fecha o dialog
            setPollingInstanceId(null);    // Para o polling
            setCurrentPairCode(null);
            toast({ title: "WhatsApp conectado!" });
            queryClient.invalidateQueries({ queryKey: ["instances"] });
        }
    }
}, [instances, pollingInstanceId]);
```

O `useQuery` com `queryKey: ["instances"]` tem `refetchInterval` ativo enquanto o polling está em andamento — cada refetch busca os dados atualizados do DB, que foram modificados pelo `uzapi-manager`.

**No InstanceRow.tsx**, cada linha de instância tem um botão "Verificar" que chama manualmente:
```typescript
const checkConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
        const { data, error } = await supabase.functions.invoke("uzapi-manager", {
            body: { action: 'check_connection', instanceId: id }
        });
        return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["instances"] })
});
```

---

## 8. Fase 4 — Instância em Uso

### Configuração de Webhook (alternativa manual)

`uzapi-manager` também suporta `action: 'configure_webhook'` para reconfigurar o webhook:

```typescript
POST uzapi-manager
{ action: 'configure_webhook', instanceId: '...' }

// Internamente faz:
POST https://clinvia.uazapi.com/webhook
Headers: { token: instanceToken }
Body:
{
  "enabled": true,
  "url": "{SUPABASE_URL}/functions/v1/webhook-queue-receiver",
  "events": ["messages", "connection", "messages_update", "ack", "history"],
  "excludeMessages": ["wasSentByApi"]
}
```

### Envio de Mensagens (cliente frontend direto)

O arquivo `src/lib/uzapi.ts` expõe um cliente que **chama a Uazapi diretamente** (sem Edge Function) para ações de mensagem. Isso é usado para envios e interações em tempo real onde a latência via Edge Function seria problemática:

```typescript
// Enviar mensagem com reply (quote)
uzapi.sendTextWithReply(instanceToken, number, text, replyId)
→ POST https://clinvia.uazapi.com/send/text
  Headers: { token: instanceToken }
  Body: { number, text, replyid }

// Editar mensagem enviada
uzapi.editMessage(instanceToken, messageId, newText)
→ POST https://clinvia.uazapi.com/message/edit
  Headers: { token: instanceToken }
  Body: { id: messageId, text: newText }

// Deletar mensagem para todos
uzapi.deleteMessage(instanceToken, messageId)
→ POST https://clinvia.uazapi.com/message/delete
  Headers: { token: instanceToken }
  Body: { id: messageId }

// Reagir com emoji
uzapi.reactToMessage(instanceToken, number, messageId, emoji)
→ POST https://clinvia.uazapi.com/message/react
  Headers: { token: instanceToken }
  Body: { number, text: emoji, id: messageId }
```

**Nota de segurança:** O `instanceToken` para chamadas de mensagem usa header `token` (não `apikey`). Na criação/deleção usa `apikey`. São o mesmo token mas com nome de header diferente dependendo do endpoint.

---

## 9. Fase 5 — Exclusão da Instância

### Edge Function: `uzapi-delete-instance`

**Trigger:** `supabase.functions.invoke('uzapi-delete-instance', { body: { instanceId } })`

```
1. Recebe: { instanceId: string }

2. Busca apikey no DB:
   SELECT apikey FROM instances WHERE id = instanceId

3. DELETE NA UAZAPI (se tiver token):
   DELETE https://clinvia.uazapi.com/instance
   Headers:
     Accept: application/json
     token: {instanceToken}

   Observação: Se falhar, apenas loga o erro e continua com delete no DB.

4. DELETE NO DB:
   DELETE FROM instances WHERE id = instanceId

5. Retorna: { success: true }
```

**Logout sem deletar** (via uzapi.ts direto):
```typescript
uzapi.logoutInstance(instanceToken)
→ DELETE https://clinvia.uazapi.com/instance/logout
  Headers: { apikey: instanceToken }
```

---

## 10. Arquitetura de Webhook com Fila

### O Problema: Thundering Herd

A Uazapi reenvia eventos se não receber 200 em tempo hábil. Se o processamento demorar, gera cascata de reenvios → deadlocks → dados duplicados.

### A Solução: Fila Assíncrona com Resposta Imediata

#### webhook-queue-receiver

**URL:** `https://swfshqvvbohnahdyndch.supabase.co/functions/v1/webhook-queue-receiver`

```
1. Recebe evento POST da Uazapi
   Extrai: instanceName, eventType do payload

2. RESPONDE 200 IMEDIATAMENTE (antes de qualquer DB)
   Body: { success: true, queued: true }

   ← A Uazapi recebe 200 e NÃO reenvia

3. EM BACKGROUND (EdgeRuntime.waitUntil):
   a. INSERT INTO webhook_queue:
      { instance_name, event_type, payload, status: 'pending' }

   b. Invoca webhook-queue-processor (fire-and-forget):
      supabase.functions.invoke('webhook-queue-processor', {})

4. Se JSON inválido: retorna 200 com { message: 'Invalid JSON ignored' }
   (nunca retorna erro para a Uazapi)
```

**Tabela `webhook_queue`:**
```sql
webhook_queue (
    id           UUID PRIMARY KEY,
    instance_name TEXT,
    event_type   TEXT,
    payload      JSONB,
    status       TEXT DEFAULT 'pending',  -- pending | processing | done | failed
    attempts     INT DEFAULT 0,
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
)
```

#### webhook-queue-processor

```
CONFIGURAÇÃO:
  BATCH_SIZE = 10  (processa até 10 jobs por invocação)
  MAX_ATTEMPTS = 3 (tentativas antes de marcar como 'failed')

FLUXO:

1. ATOMIC CLAIM (evita race conditions entre múltiplos processadores):
   UPDATE webhook_queue
   SET status = 'processing', started_at = now()
   WHERE status = 'pending' AND attempts < 3
   ORDER BY created_at ASC
   LIMIT 10
   RETURNING *

2. Para cada job claimado:

   a. Verifica eventType:
      IGNORED_EVENTS = [
        'connection', 'status.instance', 'contacts.upsert',
        'contacts.update', 'presence.update', 'chats.upsert',
        'chats.update', 'chats.delete'
      ]
      → Se ignorado: UPDATE status='done', continua

   b. ROTEAMENTO:
      - 'messages_update' | 'ack' | ReadReceipt → webhook-handle-status
      - qualquer outro → webhook-handle-message

   c. INVOCA função especializada:
      supabase.functions.invoke(targetFunction, { body: job.payload })

   d. SE SUCESSO:
      UPDATE webhook_queue SET status='done', completed_at=now()

   e. SE ERRO:
      attempts++
      status = attempts >= 3 ? 'failed' : 'pending'  (volta para retry)
      UPDATE webhook_queue SET status, attempts, error_message

3. Retorna: { success: true, processed: N, failed: M, time_ms: T }
```

**Funções especializadas de handler:**
- `webhook-handle-message` — processa mensagens recebidas/enviadas, atualiza conversas
- `webhook-handle-status` — atualiza status de leitura (ACK), receipts

---

## 11. Frontend: Connections.tsx

Arquivo: `src/pages/Connections.tsx`

### Estado

```typescript
// WhatsApp
const [name, setName] = useState("");                     // nome digitado para nova instância
const [connectDialogOpen, setConnectDialogOpen] = useState(false);
const [currentPairCode, setCurrentPairCode] = useState<string | null>(null);
const [currentInstanceName, setCurrentInstanceName] = useState("");
const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
const [pollingInstanceId, setPollingInstanceId] = useState<string | null>(null);
```

### Queries

```typescript
// Lista todas as instâncias WhatsApp do tenant
useQuery({ queryKey: ["instances"], queryFn: () =>
    supabase.from("instances").select("*").order("created_at", { ascending: false })
})
```

### Mutations

| Mutation | Edge Function | Quando disparada |
|----------|---------------|-----------------|
| `createMutation` | `uzapi-create-instance` | Botão "Criar Instância" |
| `connectMutation` | `uzapi-connect-instance` | Botão "Gerar Código de Pareamento" no dialog |
| `checkConnectionMutation` | `uzapi-manager` (check_connection) | Botão "Verificar Status" |

### Polling Automático

O `useEffect` que observa `[instances, pollingInstanceId]` verifica se a instância em espera mudou para `connected`. Esse `useEffect` depende do `useQuery` ser refetchado periodicamente — o React Query revalida automaticamente em foco de janela e pode ter `refetchInterval` configurado no componente.

### UI de Criação

```
Card "Nova Instância WhatsApp"
  Input [Nome da instância]
  Button "Criar Instância" → createMutation.mutate()

ConnectInstanceDialog (abre após criar)
  Input [Número de telefone com DDI]
  Button "Gerar Código" → connectMutation.mutate({id, phone})
  Display: código "XXXX-XXXX" formatado
  Instrução: ir no WhatsApp → Aparelhos Vinculados → Vincular com número
```

---

## 12. Frontend: InstanceRow.tsx

Arquivo: `src/components/InstanceRow.tsx`

Renderiza uma linha para cada instância existente:

```
[Avatar/Foto] [Nome da Instância] [Status Badge] [Fila Select] [Funil Select] [Verificar] [Deletar]
```

### Status Badge

```typescript
status === 'connected'    → Badge verde   "Conectado"
status === 'connecting'   → Badge amarelo "Conectando"
status === 'disconnected' → Badge cinza   "Desconectado"
```

### Selects Configuráveis

- **Fila Padrão:** `SELECT * FROM queues WHERE is_active = true`
  - Ao mudar: `UPDATE instances SET default_queue_id = queueId WHERE id = instanceId`

- **Funil Automático:** `SELECT id, name FROM crm_funnels ORDER BY created_at`
  - Ao mudar: `UPDATE instances SET auto_create_deal_funnel_id = funnelId WHERE id = instanceId`

### Botões de Ação

```typescript
// Verificar status (manual)
checkConnectionMutation.mutate(instance.id)
// → invoke uzapi-manager { action: 'check_connection', instanceId }

// Deletar instância
deleteMutation.mutate(instance.id)
// → invoke uzapi-delete-instance { instanceId }
```

---

## 13. Cliente Frontend: uzapi.ts

Arquivo: `src/lib/uzapi.ts`

Cliente JavaScript que chama a Uazapi **diretamente do browser** (sem passar por Edge Function). Usado para ações de mensagem em tempo real.

### Endpoints Cobertos

| Método | URL | Header Auth | Uso |
|--------|-----|-------------|-----|
| POST | `/instance/init` | `admintoken` | Criar instância |
| POST | `/instance/connect` | `apikey` | Gerar QR/pair code |
| GET | `/instance/status` | `apikey` | Verificar status |
| DELETE | `/instance` | `apikey` | Deletar instância |
| DELETE | `/instance/logout` | `apikey` | Deslogar instância |
| POST | `/send/text` | `token` | Enviar texto com reply |
| POST | `/message/edit` | `token` | Editar mensagem |
| POST | `/message/delete` | `token` | Deletar mensagem |
| POST | `/message/react` | `token` | Reagir com emoji |

**Nota:** Nas operações de mensagem, o header é `token`. Nas operações de instância, é `apikey`. São o mesmo token mas o Uazapi usa nomes diferentes conforme o endpoint.

---

## 14. Referência Completa das APIs Uazapi

### Base URL
```
https://clinvia.uazapi.com
```

### Autenticação

| Contexto | Header | Valor |
|----------|--------|-------|
| Criar instância (admin) | `admintoken` | Token global do servidor |
| Operações de instância | `apikey` | Token único da instância |
| Operações de mensagem | `token` | Token único da instância |

### Endpoints de Instância

#### POST /instance/init
Cria uma nova instância WhatsApp.
```json
// Request headers: admintoken
// Request body:
{ "name": "minha-clinica", "systemName": "apilocal" }

// Response:
{
  "token": "abc123...",
  "name": "minha-clinica",
  "instance": { "status": "disconnected" }
}
```

#### POST /instance/connect
Gera par code para conectar WhatsApp via número.
```json
// Request headers: token (instance token)
// Request body:
{ "phone": "5511999999999" }

// Response (pode ser array):
[{
  "instance": {
    "paircode": "ABCD1234",
    "status": "connecting",
    "name": "minha-clinica",
    "token": "abc123..."
  }
}]
```

#### GET /instance/status
Verifica status atual da instância.
```json
// Request headers: token
// No request body

// Response:
{
  "instance": {
    "status": "connected",  // "open", "connecting", "disconnected"
    "profileName": "Dr. João",
    "profilePicUrl": "https://...",
    "name": "minha-clinica"
  },
  "status": { "connected": true }
}
```

#### DELETE /instance
Remove completamente a instância.
```
// Request headers: token
// No request body
```

#### DELETE /instance/logout
Desloga o WhatsApp sem remover a instância.
```
// Request headers: apikey
```

### Endpoints de Webhook

#### POST /webhook
Configura o webhook de eventos da instância.
```json
// Request headers: token
// Request body:
{
  "enabled": true,
  "url": "https://supabase.co/functions/v1/webhook-queue-receiver",
  "events": ["messages", "connection", "messages_update", "ack", "history"],
  "excludeMessages": ["wasSentByApi"]
}
```

**Eventos disponíveis:**
- `messages` — mensagens recebidas e enviadas
- `connection` — mudanças de status de conexão
- `messages_update` — atualizações de mensagens (leitura, entrega)
- `ack` — confirmações de entrega
- `history` — histórico de mensagens

### Endpoints de Mensagem

#### POST /send/text
```json
// Request headers: token
{
  "number": "5511999999999",
  "text": "Olá!",
  "replyid": "ID_DA_MENSAGEM"  // opcional, para quote
}
```

#### POST /message/edit
```json
// Request headers: token
{ "id": "MSG_ID", "text": "Novo texto" }
```

#### POST /message/delete
```json
// Request headers: token
{ "id": "MSG_ID" }
```

#### POST /message/react
```json
// Request headers: token
{ "number": "5511999999999", "text": "👍", "id": "MSG_ID" }
```

---

## 15. Fluxo Completo End-to-End

### Criação e Conexão

```
Admin                    Frontend              Edge Functions         Uazapi
  │                         │                        │                  │
  │─── digita nome ──────▶  │                        │                  │
  │─── clica "Criar" ────▶  │                        │                  │
  │                         │──invoke create──────▶  │                  │
  │                         │                        │─POST /init──────▶│
  │                         │                        │◀──token+data─────│
  │                         │                        │─INSERT instances─▶DB
  │                         │◀──{success,id,token}───│                  │
  │◀── dialog abre ─────────│                        │                  │
  │─── digita phone ──────▶ │                        │                  │
  │─── clica "Gerar" ─────▶ │                        │                  │
  │                         │──invoke connect──────▶ │                  │
  │                         │                        │─POST /webhook───▶│
  │                         │                        │◀──200 OK─────────│
  │                         │                        │─POST /connect───▶│
  │                         │                        │◀──paircode───────│
  │                         │                        │─UPDATE instances─▶DB
  │                         │◀──{pairCode}───────────│                  │
  │◀── código "XXXX-XXXX" ──│                        │                  │
  │─── abre WhatsApp ──────▶ (dispositivo)           │                  │
  │─── digita código ──────▶ (dispositivo)           │                  │
  │                          (dispositivo)──────────────────────────────▶Uazapi
  │                                                  │                  │ conecta
  │             (polling cada ~5s)                   │                  │
  │                         │──invoke manager──────▶ │                  │
  │                         │                        │─GET /status─────▶│
  │                         │                        │◀──status=connected│
  │                         │                        │─UPDATE instances─▶DB
  │                         │◀──{status:'connected'}─│                  │
  │◀── dialog fecha ─────── │                        │                  │
  │◀── toast "Conectado!" ──│                        │                  │
```

### Recebimento de Mensagem (Webhook)

```
WhatsApp          Uazapi            webhook-receiver    webhook_queue    webhook-processor   handler
    │                │                     │                │                   │               │
    │──msg enviada──▶│                     │                │                   │               │
    │                │──POST evento──────▶ │                │                   │               │
    │                │                     │──200 imediato─▶│ (Uazapi OK)       │               │
    │                │                     │──INSERT────────▶│ status=pending    │               │
    │                │                     │──invoke processor────────────────▶ │               │
    │                │                     │                │                   │               │
    │                │                     │          UPDATE pending→processing  │               │
    │                │                     │                │                   │──invoke──────▶│
    │                │                     │                │                   │◀──success─────│
    │                │                     │                │            UPDATE status=done      │
```

---

## 16. Guia para Replicar o Sistema

### Passo 1: Configurar Servidor Uazapi

1. Ter acesso a uma instância Uazapi (auto-hospedada ou SaaS)
2. Obter o `admintoken` do servidor
3. Anotar a URL base (ex: `https://seu-servidor.uazapi.com`)

### Passo 2: Criar Tabela no Banco

```sql
CREATE TABLE instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    instance_name TEXT,
    server_url TEXT,
    apikey TEXT,  -- token único por instância
    status TEXT DEFAULT 'disconnected',
    qr_code TEXT,
    pin_code TEXT,
    client_number TEXT,
    user_name TEXT,
    profile_pic_url TEXT,
    webhook_url TEXT,
    default_queue_id UUID,  -- FK para sua tabela de filas
    user_id UUID NOT NULL,  -- FK para seu tenant/usuário
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE webhook_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_name TEXT,
    event_type TEXT,
    payload JSONB,
    status TEXT DEFAULT 'pending',
    attempts INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Passo 3: Criar Edge Functions

Criar 5 Edge Functions com a mesma lógica documentada acima:
1. `uzapi-create-instance` — valida duplicata → cria na Uazapi → salva no DB
2. `uzapi-connect-instance` — configura webhook → gera pair code → atualiza DB
3. `uzapi-manager` — verifica status + atualiza foto de perfil
4. `uzapi-delete-instance` — deleta na Uazapi + no DB
5. `webhook-queue-receiver` — responde 200 imediatamente, enfileira em background
6. `webhook-queue-processor` — processa lote de 10, roteamento atômico, retry 3x

### Passo 4: Configurar Variáveis

```bash
# Em cada Edge Function (Supabase auto-injeta):
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

# Hardcoded nas Edge Functions (ou via env):
UZAPI_URL=https://seu-servidor.uazapi.com
UZAPI_ADMIN_TOKEN=seu_admin_token_global
WEBHOOK_RECEIVER_URL=https://seu-projeto.supabase.co/functions/v1/webhook-queue-receiver
```

### Passo 5: Frontend

Mínimo necessário:
1. **Formulário de criação** — input de nome + botão que chama `uzapi-create-instance`
2. **Dialog de conexão** — input de telefone + botão que chama `uzapi-connect-instance` → exibe pair code
3. **Polling de status** — `useEffect` que monitora `instances` query + chama `uzapi-manager` periodicamente
4. **Lista de instâncias** — renderiza status, botão de verificar e deletar

### Passo 6: Webhook Handlers

Criar os handlers para os tipos de evento relevantes:
- `webhook-handle-message` — processa mensagens, cria conversas, chama IA se configurado
- `webhook-handle-status` — atualiza status de leitura/entrega (ACK)

### Armadilhas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| Uazapi reenvia eventos infinitamente | Webhook demorou > timeout para responder | Responder 200 imediatamente, processar em background |
| Race condition no processamento | Múltiplos processadores pegam o mesmo job | UPDATE atômico com WHERE status='pending' |
| Foto de perfil quebra | URL expira (temporária da Uazapi) | Baixar e re-hospedar no seu próprio Storage |
| Pair code não chega | Número com formato errado | Enviar sem `+`, com DDI: `5511999999999` |
| Token confuso | Uazapi usa `token` e `apikey` alternadamente | Instância: usar `apikey`. Mensagens: usar `token`. São o mesmo valor. |
| Resposta array vs objeto | `/instance/connect` retorna array | Sempre: `Array.isArray(data) ? data[0] : data` |
| Webhook não configurado | Connect chamado antes de webhook | Sempre configurar webhook ANTES de gerar o pair code |
