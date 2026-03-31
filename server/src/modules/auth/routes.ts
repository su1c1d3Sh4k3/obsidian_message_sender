import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../../lib/supabase.js";
import { z } from "zod";

const ADMIN_EMAIL = "suicideshake@gmail.com";

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register — Cria tenant + usuário (somente admin)
  app.post("/register", async (request, reply) => {
    // Verify admin token
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const { data: authData } = await supabaseAdmin.auth.getUser(token);
      if (authData?.user?.email !== ADMIN_EMAIL) {
        return reply.status(403).send({ error: "Apenas o administrador pode criar contas" });
      }
    } else {
      return reply.status(403).send({ error: "Apenas o administrador pode criar contas" });
    }
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(2),
        companyName: z.string().min(2),
      })
      .parse(request.body);

    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });

    if (authError) {
      return reply.status(400).send({ error: authError.message });
    }

    // 2. Criar tenant
    const slug = body.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({ name: body.companyName, slug })
      .select()
      .single();

    if (tenantError) {
      return reply.status(400).send({ error: tenantError.message });
    }

    // 3. Criar perfil do usuário
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      tenant_id: tenant.id,
      email: body.email,
      name: body.name,
      role: "owner",
    });

    if (profileError) {
      return reply.status(400).send({ error: profileError.message });
    }

    return { user: { id: authData.user.id, email: body.email }, tenant };
  });

  // POST /api/auth/login
  app.post("/login", async (request, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string(),
      })
      .parse(request.body);

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      return reply.status(401).send({ error: error.message });
    }

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("*, tenants(name, slug)")
      .eq("id", data.user.id)
      .single();

    return {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
      user: profile,
    };
  });

  // POST /api/auth/refresh
  app.post("/refresh", async (request, reply) => {
    const body = z.object({ refresh_token: z.string() }).parse(request.body);

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: body.refresh_token,
    });

    if (error) {
      return reply.status(401).send({ error: error.message });
    }

    return {
      session: {
        access_token: data.session!.access_token,
        refresh_token: data.session!.refresh_token,
        expires_at: data.session!.expires_at,
      },
    };
  });
}
