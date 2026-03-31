import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../../lib/supabase.js";

const ADMIN_EMAIL = "suicideshake@gmail.com";

async function requireAdmin(request: any, reply: any) {
  const token = request.headers.authorization?.replace("Bearer ", "");
  if (!token) return reply.status(401).send({ error: "Token não fornecido" });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user || data.user.email !== ADMIN_EMAIL) {
    return reply.status(403).send({ error: "Acesso restrito ao administrador" });
  }

  request.adminUser = data.user;
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  // GET /api/admin/dashboard — Resumo geral do sistema
  app.get("/dashboard", async () => {
    // Total tenants
    const { count: totalTenants } = await supabaseAdmin
      .from("tenants")
      .select("id", { count: "exact", head: true });

    // Total contacts across all tenants
    const { count: totalContacts } = await supabaseAdmin
      .from("contacts")
      .select("id", { count: "exact", head: true });

    // Total campaigns
    const { count: totalCampaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id", { count: "exact", head: true });

    // Total messages sent
    const { count: totalSent } = await supabaseAdmin
      .from("campaign_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent");

    const { count: totalFailed } = await supabaseAdmin
      .from("campaign_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");

    // Total senders
    const { count: totalSenders } = await supabaseAdmin
      .from("senders")
      .select("id", { count: "exact", head: true });

    const { count: connectedSenders } = await supabaseAdmin
      .from("senders")
      .select("id", { count: "exact", head: true })
      .eq("status", "connected");

    return {
      totalTenants: totalTenants ?? 0,
      totalContacts: totalContacts ?? 0,
      totalCampaigns: totalCampaigns ?? 0,
      totalSent: totalSent ?? 0,
      totalFailed: totalFailed ?? 0,
      totalSenders: totalSenders ?? 0,
      connectedSenders: connectedSenders ?? 0,
    };
  });

  // GET /api/admin/clients — Lista todos os clientes com detalhes
  app.get("/clients", async () => {
    const { data: tenants } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, plan, created_at")
      .order("created_at", { ascending: false });

    if (!tenants) return [];

    const clients = await Promise.all(
      tenants.map(async (tenant) => {
        // Users count
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id, name, email, role")
          .eq("tenant_id", tenant.id);

        // Contacts count
        const { count: contactCount } = await supabaseAdmin
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id);

        // Campaigns summary
        const { data: campaigns } = await supabaseAdmin
          .from("campaigns")
          .select("id, status, sent_count, failed_count")
          .eq("tenant_id", tenant.id);

        const totalSent = (campaigns ?? []).reduce((s, c) => s + (c.sent_count || 0), 0);
        const totalFailed = (campaigns ?? []).reduce((s, c) => s + (c.failed_count || 0), 0);
        const campaignsByStatus: Record<string, number> = {};
        for (const c of campaigns ?? []) {
          campaignsByStatus[c.status] = (campaignsByStatus[c.status] || 0) + 1;
        }

        // Senders
        const { data: senders } = await supabaseAdmin
          .from("senders")
          .select("id, name, phone, status")
          .eq("tenant_id", tenant.id);

        return {
          ...tenant,
          users: users ?? [],
          contactCount: contactCount ?? 0,
          campaignCount: campaigns?.length ?? 0,
          campaignsByStatus,
          totalSent,
          totalFailed,
          senders: senders ?? [],
        };
      }),
    );

    return clients;
  });
}
