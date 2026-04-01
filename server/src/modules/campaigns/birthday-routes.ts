import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";

export async function birthdayRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  // GET /api/birthdays/contacts?date=YYYY-MM-DD — Aniversariantes do dia
  app.get("/contacts", async (request) => {
    const query = z
      .object({
        date: z.string().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(50),
      })
      .parse(request.query);

    const targetDate = query.date || new Date().toISOString().slice(0, 10);
    // Extract month and day for birthday matching
    const [, month, day] = targetDate.split("-");

    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    // Use raw filter to match month and day from birth_date
    const { data, count, error } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, display_name, phone, organization, city, state, birth_date, is_valid, is_blacklisted, contact_tags(tag_id, tags(id, name, color))", { count: "exact" })
      .eq("tenant_id", request.user.tenant_id)
      .not("birth_date", "is", null)
      .filter("birth_date", "gte", `${targetDate.slice(0, 4) === "0000" ? "1900" : "1900"}-${month}-${day}`)
      .range(from, to)
      .order("display_name", { ascending: true });

    if (error) throw error;

    // Filter in-app to match exact month/day (Supabase doesn't support EXTRACT easily)
    // Instead, let's use a different approach with RPC or direct filtering
    // We'll query all contacts with birth_date and filter by month-day
    const { data: allBirthdays, count: totalCount, error: err2 } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, display_name, phone, organization, city, state, birth_date, is_valid, is_blacklisted, contact_tags(tag_id, tags(id, name, color))", { count: "exact" })
      .eq("tenant_id", request.user.tenant_id)
      .not("birth_date", "is", null)
      .order("display_name", { ascending: true });

    if (err2) throw err2;

    const mmdd = `${month}-${day}`;
    const filtered = (allBirthdays ?? []).filter((c: any) => {
      if (!c.birth_date) return false;
      const bd = String(c.birth_date);
      return bd.slice(5) === mmdd;
    });

    const paged = filtered.slice(from, to + 1);

    return {
      data: paged,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / query.limit),
      },
    };
  });

  // GET /api/birthdays/campaign — Campanha de aniversário do tenant
  app.get("/campaign", async (request) => {
    const { data, error } = await supabaseAdmin
      .from("birthday_campaigns")
      .select("*")
      .eq("tenant_id", request.user.tenant_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  });

  // POST /api/birthdays/campaign — Criar campanha de aniversário
  app.post("/campaign", async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1),
        message_type: z.enum(["text", "image", "audio", "video", "document", "multi"]).default("text"),
        message_body: z.string().min(1),
        media_url: z.string().optional(),
        media_filename: z.string().optional(),
        media_caption: z.string().optional(),
        sender_id: z.string().uuid().optional(),
        sender_ids: z.array(z.string().uuid()).optional(),
        delay_min: z.number().min(5).default(15),
        delay_max: z.number().min(10).default(45),
        use_spintax: z.boolean().default(false),
        send_time: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
        is_active: z.boolean().default(false),
      })
      .parse(request.body);

    // If activating, deactivate any existing active campaign
    if (body.is_active) {
      await supabaseAdmin
        .from("birthday_campaigns")
        .update({ is_active: false })
        .eq("tenant_id", request.user.tenant_id)
        .eq("is_active", true);
    }

    const { data, error } = await supabaseAdmin
      .from("birthday_campaigns")
      .insert({
        tenant_id: request.user.tenant_id,
        created_by: request.user.id,
        ...body,
      })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send(data);
  });

  // PUT /api/birthdays/campaign/:id — Atualizar campanha de aniversário
  app.put("/campaign/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const body = z
      .object({
        name: z.string().optional(),
        message_type: z.enum(["text", "image", "audio", "video", "document", "multi"]).optional(),
        message_body: z.string().optional(),
        media_url: z.string().optional(),
        media_filename: z.string().optional(),
        media_caption: z.string().optional(),
        sender_id: z.string().uuid().optional(),
        sender_ids: z.array(z.string().uuid()).optional(),
        delay_min: z.number().optional(),
        delay_max: z.number().optional(),
        use_spintax: z.boolean().optional(),
        send_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(request.body);

    // If activating, deactivate any other active campaign first
    if (body.is_active) {
      await supabaseAdmin
        .from("birthday_campaigns")
        .update({ is_active: false })
        .eq("tenant_id", request.user.tenant_id)
        .eq("is_active", true)
        .neq("id", id);
    }

    const { data, error } = await supabaseAdmin
      .from("birthday_campaigns")
      .update(body)
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return reply.status(404).send({ error: "Campanha não encontrada" });
    return data;
  });

  // DELETE /api/birthdays/campaign/:id
  app.delete("/campaign/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { error } = await supabaseAdmin
      .from("birthday_campaigns")
      .delete()
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id);

    if (error) throw error;
    return reply.status(204).send();
  });
}
