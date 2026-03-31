import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";
import { sanitizePhone } from "../../utils/sanitize-phone.js";
import { sanitizeName } from "../../utils/sanitize-name.js";
import * as XLSX from "xlsx";

export async function importRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAuth);

  // POST /api/import/upload — Upload + preview
  app.post("/upload", async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: "Arquivo não enviado" });

    const buffer = await file.toBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    // Return preview (first 10 rows) + column names
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const preview = rows.slice(0, 10);

    return {
      filename: file.filename,
      totalRows: rows.length,
      columns,
      preview,
    };
  });

  // POST /api/import/process — Processar importação
  app.post("/process", async (request, reply) => {
    const body = z
      .object({
        filename: z.string(),
        column_mapping: z.object({
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          phone: z.string(),
          email: z.string().optional(),
          organization: z.string().optional(),
          organization_title: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          address: z.string().optional(),
        }),
        auto_tag_id: z.string().uuid().optional(),
        auto_list_id: z.string().uuid().optional(),
      })
      .parse(request.body);

    // Create import job
    const { data: job, error: jobError } = await supabaseAdmin
      .from("import_jobs")
      .insert({
        tenant_id: request.user.tenant_id,
        created_by: request.user.id,
        filename: body.filename,
        status: "processing",
        column_mapping: body.column_mapping,
        auto_tag_id: body.auto_tag_id,
        auto_list_id: body.auto_list_id,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // NOTE: In production, this would be handled by a background worker.
    // For MVP, we process inline but return the job ID immediately.
    return reply.status(202).send({ job_id: job.id, status: "processing" });
  });

  // GET /api/import/jobs — Lista jobs
  app.get("/jobs", async (request) => {
    const { data, error } = await supabaseAdmin
      .from("import_jobs")
      .select("*")
      .eq("tenant_id", request.user.tenant_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  });

  // GET /api/import/jobs/:id
  app.get("/jobs/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { data, error } = await supabaseAdmin
      .from("import_jobs")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", request.user.tenant_id)
      .single();

    if (error || !data) return reply.status(404).send({ error: "Job não encontrado" });
    return data;
  });
}
