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
        tag_name: z.string().optional(),
        ddd: z.string().optional(),
        organization: z.string().optional(),
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
    if (query.organization) q = q.eq("organization", query.organization);
    if (query.ddd) q = q.like("phone", `55${query.ddd}%`);
    if (query.is_valid !== undefined) q = q.eq("is_valid", query.is_valid === "true");
    if (query.is_blacklisted !== undefined)
      q = q.eq("is_blacklisted", query.is_blacklisted === "true");

    // Tag filter: need to get contact IDs that have the tag, then filter
    if (query.tag_name || query.tag_id) {
      let tagQ = supabaseAdmin
        .from("contact_tags")
        .select("contact_id, tags!inner(name)")

      if (query.tag_id) {
        tagQ = tagQ.eq("tag_id", query.tag_id);
      } else if (query.tag_name) {
        tagQ = tagQ.eq("tags.name", query.tag_name);
      }

      const { data: tagContacts, error: tagError } = await tagQ;
      if (tagError) throw tagError;

      const contactIds = (tagContacts ?? []).map((tc: { contact_id: string }) => tc.contact_id);
      if (contactIds.length === 0) {
        return {
          data: [],
          pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
        };
      }
      q = q.in("id", contactIds);
    }

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

  // GET /api/contacts/ids — Retorna todos os IDs que casam com os filtros atuais
  app.get("/ids", async (request) => {
    const query = z
      .object({
        search: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        tag_id: z.string().uuid().optional(),
        tag_name: z.string().optional(),
        ddd: z.string().optional(),
        organization: z.string().optional(),
        is_valid: z.enum(["true", "false"]).optional(),
        is_blacklisted: z.enum(["true", "false"]).optional(),
      })
      .parse(request.query);

    let q = supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("tenant_id", request.user.tenant_id);

    if (query.search) {
      q = q.or(
        `display_name.ilike.%${query.search}%,phone.ilike.%${query.search}%,organization.ilike.%${query.search}%`,
      );
    }
    if (query.city) q = q.ilike("city", `%${query.city}%`);
    if (query.state) q = q.eq("state", query.state);
    if (query.organization) q = q.eq("organization", query.organization);
    if (query.ddd) q = q.like("phone", `55${query.ddd}%`);
    if (query.is_valid !== undefined) q = q.eq("is_valid", query.is_valid === "true");
    if (query.is_blacklisted !== undefined)
      q = q.eq("is_blacklisted", query.is_blacklisted === "true");

    if (query.tag_name || query.tag_id) {
      let tagQ = supabaseAdmin
        .from("contact_tags")
        .select("contact_id, tags!inner(name)");
      if (query.tag_id) {
        tagQ = tagQ.eq("tag_id", query.tag_id);
      } else if (query.tag_name) {
        tagQ = tagQ.eq("tags.name", query.tag_name);
      }
      const { data: tagContacts, error: tagError } = await tagQ;
      if (tagError) throw tagError;
      const contactIds = (tagContacts ?? []).map((tc: { contact_id: string }) => tc.contact_id);
      if (contactIds.length === 0) return { ids: [] };
      q = q.in("id", contactIds);
    }

    // Paginate to fetch ALL matching IDs (Supabase caps at 1000 per request)
    const allIds: string[] = [];
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await q.range(offset, offset + pageSize - 1);
      if (error) throw error;
      const batch = (data ?? []).map((r: { id: string }) => r.id);
      allIds.push(...batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }

    return { ids: allIds };
  });

  // GET /api/contacts/filter-options — Valores distintos para dropdowns
  app.get("/filter-options", async (request) => {
    const tenantId = request.user.tenant_id;

    const [citiesRes, orgsRes, dddsRes] = await Promise.all([
      supabaseAdmin
        .from("contacts")
        .select("city, state")
        .eq("tenant_id", tenantId)
        .not("city", "is", null)
        .not("city", "eq", ""),
      supabaseAdmin
        .from("contacts")
        .select("organization")
        .eq("tenant_id", tenantId)
        .not("organization", "is", null)
        .not("organization", "eq", ""),
      supabaseAdmin
        .from("contacts")
        .select("phone")
        .eq("tenant_id", tenantId),
    ]);

    if (citiesRes.error) throw citiesRes.error;
    if (orgsRes.error) throw orgsRes.error;
    if (dddsRes.error) throw dddsRes.error;

    const cities = [...new Set(
      (citiesRes.data ?? []).map((c: { city: string; state: string | null }) =>
        [c.city, c.state].filter(Boolean).join("/")
      ).filter(Boolean)
    )].sort();

    const organizations = [...new Set(
      (orgsRes.data ?? []).map((c: { organization: string }) => c.organization)
    )].sort();

    const ddds = [...new Set(
      (dddsRes.data ?? [])
        .map((c: { phone: string }) => {
          const clean = c.phone.replace(/\D/g, "");
          if (clean.startsWith("55") && clean.length >= 4) return clean.slice(2, 4);
          return null;
        })
        .filter(Boolean) as string[]
    )].sort();

    return { cities, organizations, ddds };
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

    const normalizedBirthDate = normalizeBirthDate(body.birth_date);
    const insertData: Record<string, unknown> = {
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
        notes: body.notes,
        is_valid: isValid,
        source: "manual",
    };
    if (normalizedBirthDate !== null) {
      insertData.birth_date = normalizedBirthDate;
    }

    const { data, error } = await supabaseAdmin
      .from("contacts")
      .insert(insertData)
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { birth_date: rawBirthDate, ...rest } = body;
    const update: Record<string, unknown> = { ...rest };

    if (rawBirthDate !== undefined) {
      update.birth_date = rawBirthDate ? normalizeBirthDate(rawBirthDate) : null;
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
        const tagRows = contact_ids.map((cid) => ({ contact_id: cid, tag_id: body.tag_id! }));
        for (let i = 0; i < tagRows.length; i += 500) {
          await supabaseAdmin.from("contact_tags").upsert(tagRows.slice(i, i + 500));
        }
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
        const listRows = contact_ids.map((cid) => ({ list_id: body.list_id!, contact_id: cid }));
        for (let i = 0; i < listRows.length; i += 500) {
          await supabaseAdmin.from("list_contacts").upsert(listRows.slice(i, i + 500));
        }
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
        for (let i = 0; i < contact_ids.length; i += 500) {
          await supabaseAdmin
            .from("contacts")
            .delete()
            .in("id", contact_ids.slice(i, i + 500))
            .eq("tenant_id", request.user.tenant_id);
        }
        break;
      }
    }

    return { success: true, affected: contact_ids.length };
  });
}
