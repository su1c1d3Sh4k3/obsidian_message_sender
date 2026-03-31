import type { FastifyRequest, FastifyReply } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return reply.status(401).send({ error: "Token não fornecido" });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return reply.status(401).send({ error: "Token inválido" });
  }

  // Fetch user profile with tenant_id
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, tenant_id, role, name, email")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    return reply.status(403).send({ error: "Perfil não encontrado" });
  }

  request.user = profile;
}

// Augment Fastify types
declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      tenant_id: string;
      role: string;
      name: string;
      email: string;
    };
  }
}
