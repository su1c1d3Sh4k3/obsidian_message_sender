import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

// Client with service_role for backend operations (bypasses RLS)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Create a client scoped to a user's JWT (respects RLS)
export function createSupabaseClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
