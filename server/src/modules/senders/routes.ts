import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";
import { uzapiFetch } from "../../lib/uzapi.js";
import { env } from "../../config/env.js";

// ── Routes ──────────────────────────────────────────
export async function sendersRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  // GET /api/senders — lista remetentes
  app.get("/", async (request) => {
    const { data, error } = await supabaseAdmin
      .from("senders")
      .select("*")
      .eq("tenant_id", request.user.tenant_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  });

  // POST /api/senders/create-instance — cria instância na Uazapi + salva no banco
  app.post("/create-instance", async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1),
      })
      .parse(request.body);

    // Sanitiza nome para a Uazapi
    const instanceName = body.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "");

    // 1. Cria instância na Uazapi
    let uzapiData: { token?: string; name?: string };
    try {
      uzapiData = await uzapiFetch("/instance/init", {
        adminToken: true,
        body: { name: instanceName, systemName: "apilocal" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar instância na Uazapi";
      return reply.status(502).send({ error: msg });
    }

    const instanceToken = uzapiData.token;
    if (!instanceToken) {
      return reply.status(502).send({ error: "Uazapi não retornou token da instância" });
    }

    // 2. Salva no banco
    const { data, error } = await supabaseAdmin
      .from("senders")
      .insert({
        tenant_id: request.user.tenant_id,
        name: body.name,
        phone: "",
        uzapi_instance_id: instanceName,
        uzapi_token: instanceToken,
        uzapi_url: env.UZAPI_URL,
        status: "disconnected",
        settings: { pin_code: null, instance_name: instanceName },
      })
      .select()
      .single();

    if (error) throw error;

    return reply.status(201).send(data);
  });

  // POST /api/senders/:id/connect — gera pair code para conectar WhatsApp
  app.post("/:id/connect", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ phone: z.string().min(10) }).parse(request.body);

    // Busca sender no banco
    const { data: sender } = await supabaseAdmin
      .from("senders")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (!sender) return reply.status(404).send({ error: "Remetente não encontrado" });

    const token = sender.uzapi_token;

    // 1. Configura webhook (antes do pair code)
    try {
      await uzapiFetch("/webhook", {
        token,
        body: {
          enabled: true,
          url: `${env.CORS_ORIGIN}/api/webhooks/uzapi`,
          events: ["messages", "connection", "messages_update"],
          excludeMessages: ["wasSentByApi"],
        },
      });
    } catch {
      // Não bloqueia se webhook falhar
    }

    // 2. Gera pair code
    let pairCode: string;
    try {
      const data = await uzapiFetch("/instance/connect", {
        token,
        body: { phone: body.phone },
      });

      // Resposta pode ser array
      const item = Array.isArray(data) ? data[0] : data;
      pairCode = item?.instance?.paircode || item?.paircode || "";

      if (!pairCode) {
        return reply.status(502).send({ error: "Uazapi não retornou pair code" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar código de pareamento";
      return reply.status(502).send({ error: msg });
    }

    // 3. Atualiza banco
    const settings = (sender.settings as Record<string, unknown>) || {};
    await supabaseAdmin
      .from("senders")
      .update({
        phone: body.phone,
        status: "connecting",
        settings: { ...settings, pin_code: pairCode },
      })
      .eq("id", id);

    return { success: true, pairCode, status: "connecting" };
  });

  // POST /api/senders/:id/check-status — verifica status na Uazapi
  app.post("/:id/check-status", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { data: sender } = await supabaseAdmin
      .from("senders")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (!sender) return reply.status(404).send({ error: "Remetente não encontrado" });

    try {
      const data = await uzapiFetch("/instance/status", {
        method: "GET",
        token: sender.uzapi_token,
      });

      const instance = data.instance || data;
      const rawStatus = instance.status || (data.status?.connected ? "connected" : "disconnected");

      // Mapeia status
      let newStatus: string;
      if (rawStatus === "connected" || rawStatus === "open") {
        newStatus = "connected";
      } else if (rawStatus === "connecting") {
        newStatus = "connecting";
      } else {
        newStatus = "disconnected";
      }

      const profileName = instance.profileName || instance.user_name || null;

      await supabaseAdmin
        .from("senders")
        .update({
          status: newStatus,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", id);

      return {
        status: newStatus,
        profileName,
        profilePicUrl: instance.profilePicUrl || null,
      };
    } catch {
      await supabaseAdmin.from("senders").update({ status: "disconnected" }).eq("id", id);
      return { status: "disconnected", error: "Falha ao conectar com Uazapi" };
    }
  });

  // POST /api/senders/:id/disconnect — desloga sem deletar instância
  app.post("/:id/disconnect", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { data: sender } = await supabaseAdmin
      .from("senders")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (!sender) return reply.status(404).send({ error: "Remetente não encontrado" });

    try {
      await uzapiFetch("/instance/logout", {
        method: "DELETE",
        token: sender.uzapi_token,
      });
    } catch {
      // Continua mesmo se falhar
    }

    await supabaseAdmin
      .from("senders")
      .update({ status: "disconnected" })
      .eq("id", id);

    return { success: true };
  });

  // DELETE /api/senders/:id — deleta instância na Uazapi + banco
  app.delete("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { data: sender } = await supabaseAdmin
      .from("senders")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (!sender) return reply.status(404).send({ error: "Remetente não encontrado" });

    // Verifica se a instância ainda existe na Uazapi antes de tentar deletar
    if (sender.uzapi_token) {
      try {
        const statusData = await uzapiFetch("/instance/status", {
          method: "GET",
          token: sender.uzapi_token,
        });
        // Instância existe na Uazapi — deleta lá também
        if (statusData && !statusData.raw) {
          try {
            await uzapiFetch("/instance", {
              method: "DELETE",
              token: sender.uzapi_token,
            });
          } catch {
            // Falha ao deletar na Uazapi, mas continua com delete no banco
          }
        }
      } catch {
        // Instância não existe na Uazapi (404 ou erro) — só remove do banco
      }
    }

    await supabaseAdmin.from("senders").delete().eq("id", id);

    return reply.status(204).send();
  });
}
