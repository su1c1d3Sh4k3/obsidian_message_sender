import { supabase } from "./supabase";

const API_URL = "/api";

async function getAuthHeaders(includeContentType = true): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}, includeContentType = true): Promise<T> {
  const headers = await getAuthHeaders(includeContentType);

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

export async function uploadFile(file: File | Blob, filename?: string): Promise<{ url: string; mimetype: string }> {
  const headers = await getAuthHeaders(false); // no Content-Type, let browser set multipart boundary
  const form = new FormData();
  const f = file instanceof File ? file : new File([file], filename || "file", { type: file.type });
  form.append("file", f);

  const res = await fetch(`${API_URL}/campaigns/upload`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, {}, false),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }, !!body),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }, !!body),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }, false),
};
