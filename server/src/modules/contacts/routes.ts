import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";
import { sanitizePhone } from "../../utils/sanitize-phone.js";
import { sanitizeName } from "../../utils/sanitize-name.js";
import { normalizeBirthDate } from "../../utils/normalize-date.js";

export async function contactsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  // GET /api/contacts — Listagem paginada
  app.get("/", async (request) => {
    const query = z
      .object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(25),
        search: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        tag_id: z.string().uuid().optional(),
        list_id: z.string().uuid().optional(),
        is_valid: z.enum(["true", "false"]).optional(),
        is_blacklisted: z.enum(["true", "false"]).optional(),
        sort_by: z.string().default("created_at"),
        sort_order: z.enum(["asc", "desc"]).default("desc"),
      })
      .parse(request.query);

    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    let q = supabaseAdmin
      .from("contacts")
      .select("*, contact_tags(tag_id, tags(id, name, color))", { count: "exact" })
      .eq("tenant_id", request.user.tenant_id)
      .range(from, to)
      .order(query.sort_by, { ascending: query.sort_order === "asc" });

    if (query.search) {
      q = q.or(
        `display_name.ilike.%${query.search}%,phone.ilike.%${query.search}%,organization.ilike.%${query.search}%`,
      );
    }
    if (query.city) q = q.ilike("city", `%${query.city}%`);
    if (query.state) q = q.eq("state", query.state);
    if (query.is_valid !== undefined) q = q.eq("is_valid", query.is_valid === "true");
    if (query.is_blacklisted !== undefined)
      q = q.eq("is_blacklisted", query.is_blacklisted === "true");

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

  // GET /api/contacts/:id
  app.get("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("*, contact_tags(tag_id, tags(id, name, color))")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (error || !data) return reply.status(404).send({ error: "Contato não encontrado" });

    return data;
  });

  // POST /api/contacts — Criar contato
  app.post("/", async (request, reply) => {
    const emptyToUndefined = z.literal("").transform(() => undefined);
    const optionalString = z.string().optional().or(emptyToUndefined);
    const optionalEmail = z.string().email().optional().or(emptyToUndefined);

    const body = z
      .object({
        first_name: optionalString,
        last_name: optionalString,
        phone: z.string(),
        email: optionalEmail,
        organization: optionalString,
        organization_title: optionalString,
        city: optionalString,
        state: optionalString,
        address: optionalString,
        birth_date: optionalString,
        notes: optionalString,
        tag_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(request.body);

    const { phone, isValid } = sanitizePhone(body.phone);
    const displayName = body.first_name
      ? sanitizeName([body.first_name, body.last_name].filter(Boolean).join(" ")).displayName
      : "Sem Nome";

    const { data, error } = await supabaseAdmin
      .from("contacts")
      .insert({
        tenant_id: request.user.tenant_id,
        first_name: body.first_name,
        last_name: body.last_name,
        display_name: displayName,
        phone,
        phone_raw: body.phone,
        email: body.email,
        organization: body.organization,
        organization_title: body.organization_title,
        city: body.city,
        state: body.state,
        address: body.address,
        birth_date: normalizeBirthDate(body.birth_date),
        notes: body.notes,
        is_valid: isValid,
        source: "manual",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return reply.status(409).send({ error: "Telefone já cadastrado" });
      }
      throw error;
    }

    // Assign tags
    if (body.tag_ids?.length) {
      await supabaseAdmin
        .from("contact_tags")
        .insert(body.tag_ids.map((tag_id) => ({ contact_id: data.id, tag_id })));
    }

    return reply.status(201).send(data);
  });

  // PUT /api/contacts/:id
  app.put("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const emptyToNull = z.literal("").transform(() => null);
    const nullableString = z.string().nullable().optional().or(emptyToNull);
    const nullableEmail = z.string().email().nullable().optional().or(emptyToNull);

    const body = z
      .object({
        first_name: z.string().optional().or(z.literal("").transform(() => undefined)),
        last_name: z.string().optional().or(z.literal("").transform(() => undefined)),
        phone: z.string().optional(),
        email: nullableEmail,
        organization: nullableString,
        organization_title: nullableString,
        city: nullableString,
        state: nullableString,
        address: nullableString,
        birth_date: nullableString,
        notes: nullableString,
      })
      .parse(request.body);

    const update: Record<string, unknown> = { ...body };

    if (body.birth_date !== undefined) {
      update.birth_date = body.birth_date ? normalizeBirthDate(body.birth_date) : null;
    }

    if (body.phone) {
      const { phone, isValid } = sanitizePhone(body.phone);
      update.phone = phone;
      update.phone_raw = body.phone;
      update.is_valid = isValid;
    }

    if (body.first_name || body.last_name) {
      update.display_name = sanitizeName(
        [body.first_name, body.last_name].filter(Boolean).join(" "),
      ).displayName;
    }

    const { data, error } = await supabaseAdmin
      .from("contacts")
      .update(update)
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return reply.status(404).send({ error: "Contato não encontrado" });

    return data;
  });

  // DELETE /api/contacts/:id
  app.delete("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { error } = await supabaseAdmin
      .from("contacts")
      .delete()
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id);

    if (error) throw error;

    return reply.status(204).send();
  });

  // POST /api/contacts/bulk-action
  app.post("/bulk-action", async (request) => {
    const body = z
      .object({
        contact_ids: z.array(z.string().uuid()).min(1),
        action: z.enum(["add_tag", "remove_tag", "add_to_list", "remove_from_list", "blacklist", "delete"]),
        tag_id: z.string().uuid().optional(),
        list_id: z.string().uuid().optional(),
      })
      .parse(request.body);

    const { contact_ids, action } = body;

    switch (action) {
      case "add_tag": {
        if (!body.tag_id) throw new Error("tag_id required");
        await supabaseAdmin
          .from("contact_tags")
          .upsert(contact_ids.map((cid) => ({ contact_id: cid, tag_id: body.tag_id! })));
        break;
      }
      case "remove_tag": {
        if (!body.tag_id) throw new Error("tag_id required");
        await supabaseAdmin
          .from("contact_tags")
          .delete()
          .in("contact_id", contact_ids)
          .eq("tag_id", body.tag_id);
        break;
      }
      case "add_to_list": {
        if (!body.list_id) throw new Error("list_id required");
        await supabaseAdmin
          .from("list_contacts")
          .upsert(contact_ids.map((cid) => ({ list_id: body.list_id!, contact_id: cid })));
        break;
      }
      case "remove_from_list": {
        if (!body.list_id) throw new Error("list_id required");
        await supabaseAdmin
          .from("list_contacts")
          .delete()
          .in("contact_id", contact_ids)
          .eq("list_id", body.list_id);
        break;
      }
      case "blacklist": {
        await supabaseAdmin
          .from("contacts")
          .update({ is_blacklisted: true })
          .in("id", contact_ids)
          .eq("tenant_id", request.user.tenant_id);
        break;
      }
      case "delete": {
        await supabaseAdmin
          .from("contacts")
          .delete()
          .in("id", contact_ids)
          .eq("tenant_id", request.user.tenant_id);
        break;
      }
    }

    return { success: true, affected: contact_ids.length };
  });
}
