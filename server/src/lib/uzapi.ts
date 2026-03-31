import { env } from "../config/env.js";

export async function uzapiFetch(
  path: string,
  opts: { method?: string; token?: string; adminToken?: boolean; body?: unknown },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (opts.adminToken) {
    headers.admintoken = env.UZAPI_ADMIN_TOKEN;
  } else if (opts.token) {
    headers.token = opts.token;
    headers.apikey = opts.token;
  }

  const res = await fetch(`${env.UZAPI_URL}${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Uazapi error ${res.status}: ${text.slice(0, 200)}`);
    }
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `Uazapi error ${res.status}`);
  }

  return data;
}
