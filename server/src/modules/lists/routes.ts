import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";

export async function listsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  app.get("/", async (request) => {
    const { data, error } = await supabaseAdmin
      .from("lists")
      .select("*, list_contacts(count)")
      .eq("tenant_id", request.user.tenant_id)
      .order("name");

    if (error) throw error;

    // Replace cached contact_count with real count from list_contacts
    return (data ?? []).map((list) => ({
      ...list,
      contact_count: (list as unknown as { list_contacts: { count: number }[] }).list_contacts?.[0]?.count ?? 0,
      list_contacts: undefined,
    }));
  });

  app.post("/", async (request, reply) => {
    const body = z
      .object({ name: z.string().min(1), description: z.string().optional() })
      .parse(request.body);

    const { data, error } = await supabaseAdmin
      .from("lists")
      .insert({ tenant_id: request.user.tenant_id, ...body })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send(data);
  });

  app.put("/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ name: z.string().optional(), description: z.string().optional() }).parse(request.body);

    const { data, error } = await supabaseAdmin
      .from("lists")
      .update(body)
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    await supabaseAdmin.from("lists").delete().eq("id", id).eq("tenant_id", request.user.tenant_id);

    return reply.status(204).send();
  });

  // GET /api/lists/:id/contacts
  app.get("/:id/contacts", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const query = z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().default(25) }).parse(request.query);

    // Verify list belongs to user's tenant
    const { data: list } = await supabaseAdmin
      .from("lists")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (!list) return reply.status(404).send({ error: "Lista não encontrada" });

    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    const { data, count, error } = await supabaseAdmin
      .from("list_contacts")
      .select("contacts(*)", { count: "exact" })
      .eq("list_id", id)
      .range(from, to);

    if (error) throw error;

    return {
      data: data?.map((lc: { contacts: unknown }) => lc.contacts) ?? [],
      pagination: { page: query.page, limit: query.limit, total: count ?? 0 },
    };
  });
}
