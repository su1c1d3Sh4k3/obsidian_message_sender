import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  // POST /api/settings/change-password
  app.post("/change-password", async (request, reply) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      })
      .parse(request.body);

    // Verify current password by trying to sign in
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: request.user.email,
      password: body.currentPassword,
    });

    if (signInError) {
      return reply.status(400).send({ error: "Senha atual incorreta" });
    }

    // Update password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(request.user.id, {
      password: body.newPassword,
    });

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return { success: true };
  });

  // GET /api/settings/notifications — retorna config de notificação do tenant
  app.get("/notifications", async (request) => {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("settings")
      .eq("id", request.user.tenant_id)
      .single();

    const settings = (data?.settings as Record<string, unknown>) ?? {};

    return {
      notify_enabled: settings.notify_enabled ?? false,
      notify_phone: settings.notify_phone ?? "",
      notify_sender_id: settings.notify_sender_id ?? null,
    };
  });

  // PUT /api/settings/notifications — salva config de notificação
  app.put("/notifications", async (request, reply) => {
    const body = z
      .object({
        notify_enabled: z.boolean(),
        notify_phone: z.string(),
        notify_sender_id: z.string().uuid().nullable(),
      })
      .parse(request.body);

    // Get current settings and merge
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("settings")
      .eq("id", request.user.tenant_id)
      .single();

    const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({
        settings: {
          ...currentSettings,
          notify_enabled: body.notify_enabled,
          notify_phone: body.notify_phone,
          notify_sender_id: body.notify_sender_id,
        },
      })
      .eq("id", request.user.tenant_id);

    if (error) throw error;

    return { success: true };
  });
}
