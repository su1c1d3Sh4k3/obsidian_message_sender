import { supabase } from "./supabase";
const API_URL = "/api";
async function getAuthHeaders(includeContentType = true) {
    const { data: { session }, } = await supabase.auth.getSession();
    const headers = {};
    if (includeContentType) {
        headers["Content-Type"] = "application/json";
    }
    if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
}
async function request(path, options = {}, includeContentType = true) {
    const headers = await getAuthHeaders(includeContentType);
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Request failed: ${res.status}`);
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
export async function uploadFile(file, filename) {
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
    get: (path) => request(path, {}, false),
    post: (path, body) => request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }, !!body),
    put: (path, body) => request(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }, !!body),
    delete: (path) => request(path, { method: "DELETE" }, false),
};
//# sourceMappingURL=api.js.map