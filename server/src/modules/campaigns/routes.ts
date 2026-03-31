import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  startCampaign,
  resumeCampaign,
  pauseCampaign,
  cancelCampaign,
} from "../../workers/campaign-dispatcher.js";

export async function campaignsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  // GET /api/campaigns
  app.get("/", async (request) => {
    const query = z
      .object({
        status: z.string().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(25),
      })
      .parse(request.query);

    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    let q = supabaseAdmin
      .from("campaigns")
      .select("*", { count: "exact" })
      .eq("tenant_id", request.user.tenant_id)
      .range(from, to)
      .order("created_at", { ascending: false });

    if (query.status) q = q.eq("status", query.status);

    const { data, count, error } = await q;
    if (error) throw error;

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / query.limit),
      },
    };
  });

  // GET /api/campaigns/:id
  app.get("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (error || !data) return reply.status(404).send({ error: "Campanha não encontrada" });
    return data;
  });

  // POST /api/campaigns
  app.post("/", async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1),
        target_type: z.enum(["list", "tag", "filter"]),
        target_list_id: z.string().uuid().optional(),
        target_tag_id: z.string().uuid().optional(),
        target_filter: z.record(z.unknown()).optional(),
        message_type: z.enum(["text", "image", "audio", "video", "document", "multi"]).default("text"),
        message_body: z.string().min(1),
        media_url: z.string().optional(),
        media_filename: z.string().optional(),
        media_caption: z.string().optional(),
        sender_id: z.string().uuid().optional(),
        sender_ids: z.array(z.string().uuid()).optional(),
        delay_min: z.number().min(5).default(15),
        delay_max: z.number().min(10).default(45),
        daily_limit: z.number().optional(),
        use_spintax: z.boolean().default(false),
        scheduled_at: z.string().datetime().optional(),
      })
      .parse(request.body);

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        tenant_id: request.user.tenant_id,
        created_by: request.user.id,
        ...body,
        status: body.scheduled_at ? "scheduled" : "draft",
      })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send(data);
  });

  // PUT /api/campaigns/:id
  app.put("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    // Only allow editing drafts
    const { data: existing } = await supabaseAdmin
      .from("campaigns")
      .select("status")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (!existing) return reply.status(404).send({ error: "Campanha não encontrada" });
    if (!["draft", "scheduled"].includes(existing.status)) {
      return reply.status(400).send({ error: "Só é possível editar campanhas em rascunho ou agendadas" });
    }

    const body = z.object({
      name: z.string().optional(),
      message_type: z.enum(["text", "image", "audio", "video", "document", "multi"]).optional(),
      message_body: z.string().optional(),
      target_type: z.enum(["list", "tag", "filter"]).optional(),
      target_list_id: z.string().uuid().optional(),
      target_tag_id: z.string().uuid().optional(),
      sender_id: z.string().uuid().optional(),
      sender_ids: z.array(z.string().uuid()).optional(),
      delay_min: z.number().optional(),
      delay_max: z.number().optional(),
      daily_limit: z.number().nullable().optional(),
      use_spintax: z.boolean().optional(),
      scheduled_at: z.string().datetime().nullable().optional(),
    }).parse(request.body);

    // Auto-set status based on scheduled_at
    const updateData: Record<string, unknown> = { ...body };
    if (body.scheduled_at !== undefined) {
      updateData.status = body.scheduled_at ? "scheduled" : "draft";
    }

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  });

  // POST /api/campaigns/:id/action — Pausar, retomar, cancelar
  app.post("/:id/action", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { action } = z.object({ action: z.enum(["start", "pause", "resume", "cancel", "reactivate"]) }).parse(request.body);

    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (!campaign) return reply.status(404).send({ error: "Campanha não encontrada" });

    const transitions: Record<string, string[]> = {
      start: ["draft", "scheduled"],
      pause: ["running"],
      resume: ["paused"],
      cancel: ["draft", "scheduled", "running", "paused"],
      reactivate: ["completed", "cancelled", "failed"],
    };

    if (!transitions[action].includes(campaign.status)) {
      return reply.status(400).send({ error: `Ação "${action}" não permitida para status "${campaign.status}"` });
    }

    const statusMap: Record<string, string> = {
      start: "running",
      pause: "paused",
      resume: "running",
      cancel: "cancelled",
      reactivate: "draft",
    };

    const update: Record<string, unknown> = { status: statusMap[action] };
    if (action === "start") update.started_at = new Date().toISOString();

    // Reactivate: reset counters and delete old messages
    if (action === "reactivate") {
      update.sent_count = 0;
      update.failed_count = 0;
      update.delivered_count = 0;
      update.total_contacts = 0;
      update.started_at = null;
      update.completed_at = null;

      await supabaseAdmin
        .from("campaign_messages")
        .delete()
        .eq("campaign_id", id);
    }

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Trigger dispatcher
    try {
      if (action === "start") {
        // Fire and forget — don't block the response
        startCampaign(id, request.user.tenant_id).catch((err) => {
          console.error(`[dispatcher] start error:`, err);
          supabaseAdmin.from("campaigns").update({ status: "failed" }).eq("id", id);
        });
      } else if (action === "resume") {
        resumeCampaign(id, request.user.tenant_id).catch((err) => {
          console.error(`[dispatcher] resume error:`, err);
        });
      } else if (action === "pause") {
        pauseCampaign(id);
      } else if (action === "cancel") {
        await cancelCampaign(id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no dispatcher";
      return reply.status(500).send({ error: msg });
    }

    return data;
  });

  // POST /api/campaigns/upload — Upload de mídia para Supabase Storage
  app.post("/upload", async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: "Nenhum arquivo enviado" });

    const buffer = await file.toBuffer();
    const ext = file.filename.split(".").pop() || "bin";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from("campaign-media")
      .upload(path, buffer, { contentType: file.mimetype });

    if (error) {
      return reply.status(500).send({ error: `Erro no upload: ${error.message}` });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("campaign-media")
      .getPublicUrl(path);

    return { url: urlData.publicUrl, mimetype: file.mimetype };
  });

  // GET /api/campaigns/:id/messages — Logs de envio
  app.get("/:id/messages", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const query = z
      .object({
        status: z.string().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(50),
      })
      .parse(request.query);

    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    let q = supabaseAdmin
      .from("campaign_messages")
      .select("*", { count: "exact" })
      .eq("campaign_id", id)
      .range(from, to)
      .order("created_at", { ascending: false });

    if (query.status) q = q.eq("status", query.status);

    const { data, count, error } = await q;
    if (error) throw error;

    return {
      data,
      pagination: { page: query.page, limit: query.limit, total: count ?? 0 },
    };
  });
}
