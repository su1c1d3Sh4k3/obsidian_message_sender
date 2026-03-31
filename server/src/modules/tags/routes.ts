import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";

export async function tagsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  app.get("/", async (request) => {
    const { data, error } = await supabaseAdmin
      .from("tags")
      .select("*")
      .eq("tenant_id", request.user.tenant_id)
      .order("name");

    if (error) throw error;
    return data;
  });

  app.post("/", async (request, reply) => {
    const body = z
      .object({ name: z.string().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3B82F6") })
      .parse(request.body);

    const { data, error } = await supabaseAdmin
      .from("tags")
      .insert({ tenant_id: request.user.tenant_id, ...body })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return reply.status(409).send({ error: "Tag já existe" });
      throw error;
    }

    return reply.status(201).send(data);
  });

  app.put("/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ name: z.string().optional(), color: z.string().optional() }).parse(request.body);

    const { data, error } = await supabaseAdmin
      .from("tags")
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

    await supabaseAdmin.from("tags").delete().eq("id", id).eq("tenant_id", request.user.tenant_id);

    return reply.status(204).send();
  });
}
