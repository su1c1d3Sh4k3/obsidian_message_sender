import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth } from "../../middleware/auth.js";
import { sanitizePhone } from "../../utils/sanitize-phone.js";
import { sanitizeName } from "../../utils/sanitize-name.js";
import { normalizeBirthDate } from "../../utils/normalize-date.js";
import * as XLSX from "xlsx";

// In-memory store for uploaded file buffers (keyed by filename)
// Files are cleaned up after processing or after 30 minutes
const uploadedFiles = new Map<string, { buffer: Buffer; timestamp: number }>();

// Clean up old uploads every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of uploadedFiles) {
    if (now - value.timestamp > 30 * 60 * 1000) {
      uploadedFiles.delete(key);
    }
  }
}, 10 * 60 * 1000);

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

    // Store buffer in memory for later processing
    const fileKey = `${request.user.tenant_id}_${Date.now()}_${file.filename}`;
    uploadedFiles.set(fileKey, { buffer, timestamp: Date.now() });

    // Return preview (first 10 rows) + column names
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const preview = rows.slice(0, 10);

    return {
      filename: fileKey,
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
          city_state: z.string().optional(),
          tag: z.string().optional(),
          address: z.string().optional(),
          birth_date: z.string().optional(),
        }),
        auto_tag_id: z.string().uuid().optional(),
        auto_list_id: z.string().uuid().optional(),
      })
      .parse(request.body);

    // Retrieve stored file buffer
    const stored = uploadedFiles.get(body.filename);
    if (!stored) {
      return reply.status(400).send({ error: "Arquivo expirado. Faça upload novamente." });
    }

    // Parse the file again
    const workbook = XLSX.read(stored.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    app.log.info({ totalRows: rows.length, columns: rows[0] ? Object.keys(rows[0]) : [], mapping: body.column_mapping, firstRow: rows[0] }, "Import process started");

    // Create import job
    const { data: job, error: jobError } = await supabaseAdmin
      .from("import_jobs")
      .insert({
        tenant_id: request.user.tenant_id,
        created_by: request.user.id,
        filename: body.filename,
        status: "processing",
        total_rows: rows.length,
        column_mapping: body.column_mapping,
        auto_tag_id: body.auto_tag_id,
        auto_list_id: body.auto_list_id,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Clean up stored file
    uploadedFiles.delete(body.filename);

    // Process contacts in batches
    const mapping = body.column_mapping;
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    const errors: { row: number; error: string }[] = [];
    const warnings: { row: number; phone: string; warning: string }[] = [];
    const BATCH_SIZE = 100;

    // Cache for tag name → tag id (to avoid creating duplicates)
    const tagCache = new Map<string, string>();

    // Pre-load existing tags for this tenant
    if (mapping.tag) {
      const { data: existingTags } = await supabaseAdmin
        .from("tags")
        .select("id, name")
        .eq("tenant_id", request.user.tenant_id);
      if (existingTags) {
        for (const t of existingTags) {
          tagCache.set(t.name.toLowerCase().trim(), t.id);
        }
      }
    }

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const contacts: { data: Record<string, unknown>; rowIndex: number; phoneWarnings: string[]; rawPhone: string; tagName?: string }[] = [];

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowIndex = i + j + 2; // +2 for 1-based index + header row

        try {
          const rawPhone = row[mapping.phone];
          if (!rawPhone) {
            skippedCount++;
            errors.push({ row: rowIndex, error: "Telefone vazio" });
            continue;
          }

          const { phone, isValid, warnings: phoneWarnings } = sanitizePhone(String(rawPhone));

          const firstName = mapping.first_name ? String(row[mapping.first_name] || "") : "";
          const lastName = mapping.last_name ? String(row[mapping.last_name] || "") : "";
          const nameRaw = [firstName, lastName].filter(Boolean).join(" ");
          const { displayName, orgExtracted } = nameRaw
            ? sanitizeName(nameRaw)
            : { displayName: "Sem Nome", orgExtracted: undefined };

          contacts.push({
            rowIndex,
            rawPhone: phone,
            phoneWarnings,
            data: {
              tenant_id: request.user.tenant_id,
              first_name: firstName || null,
              last_name: lastName || null,
              display_name: displayName,
              phone,
              phone_raw: String(rawPhone),
              email: mapping.email ? String(row[mapping.email] || "") || null : null,
              organization:
                (mapping.organization ? String(row[mapping.organization] || "") || null : null) ??
                orgExtracted ??
                null,
              organization_title: mapping.organization_title
                ? String(row[mapping.organization_title] || "") || null
                : null,
              city: mapping.city_state
                ? (String(row[mapping.city_state] || "").split("/")[0]?.trim() || null)
                : (mapping.city ? String(row[mapping.city] || "") || null : null),
              state: mapping.city_state
                ? (String(row[mapping.city_state] || "").split("/")[1]?.trim() || null)
                : (mapping.state ? String(row[mapping.state] || "") || null : null),
              address: mapping.address ? String(row[mapping.address] || "") || null : null,
              birth_date: mapping.birth_date ? normalizeBirthDate(row[mapping.birth_date]) : null,
              is_valid: isValid,
              source: "import",
              import_job_id: job.id,
            },
            tagName: mapping.tag ? String(row[mapping.tag] || "").trim() || undefined : undefined,
          });
        } catch (err) {
          errorCount++;
          errors.push({
            row: rowIndex,
            error: err instanceof Error ? err.message : "Erro desconhecido",
          });
        }
      }

      if (contacts.length > 0) {
        // Insert contacts one-by-one to handle duplicates gracefully
        const insertedIds: string[] = [];
        for (const contact of contacts) {
          const { data: row, error: insertError } = await supabaseAdmin
            .from("contacts")
            .upsert(contact.data, { onConflict: "tenant_id,phone" })
            .select("id")
            .single();

          if (insertError) {
            errorCount++;
            errors.push({
              row: contact.rowIndex,
              error: `${contact.rawPhone}: ${insertError.message}`,
            });
            app.log.error({ err: insertError, phone: contact.rawPhone }, "Import insert error");
          } else if (row) {
            importedCount++;
            insertedIds.push(row.id);

            // Assign tag from spreadsheet column
            if (contact.tagName) {
              const tagKey = contact.tagName.toLowerCase();
              let tagId = tagCache.get(tagKey);

              // Create tag if it doesn't exist
              if (!tagId) {
                const { data: newTag } = await supabaseAdmin
                  .from("tags")
                  .insert({ tenant_id: request.user.tenant_id, name: contact.tagName, color: "#3B82F6" })
                  .select("id")
                  .single();
                if (newTag) {
                  tagId = newTag.id;
                  tagCache.set(tagKey, tagId!);
                }
              }

              if (tagId) {
                await supabaseAdmin
                  .from("contact_tags")
                  .upsert({ contact_id: row.id, tag_id: tagId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
              }
            }

            // Collect phone warnings for successfully imported contacts
            if (contact.phoneWarnings.length > 0) {
              warningCount++;
              warnings.push({
                row: contact.rowIndex,
                phone: contact.rawPhone,
                warning: contact.phoneWarnings.join("; "),
              });
            }
          }
        }

        // Auto-tag imported contacts
        if (body.auto_tag_id && insertedIds.length) {
          await supabaseAdmin
            .from("contact_tags")
            .upsert(
              insertedIds.map((id) => ({ contact_id: id, tag_id: body.auto_tag_id! })),
              { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
            );
        }

        // Auto-add to list
        if (body.auto_list_id && insertedIds.length) {
          await supabaseAdmin
            .from("list_contacts")
            .upsert(
              insertedIds.map((id) => ({ list_id: body.auto_list_id!, contact_id: id })),
              { onConflict: "list_id,contact_id", ignoreDuplicates: true },
            );
        }
      }
    }

    // Update job status
    await supabaseAdmin
      .from("import_jobs")
      .update({
        status: errorCount > 0 && importedCount === 0 ? "failed" : "completed",
        imported_count: importedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        errors: errors.slice(0, 100), // limit stored errors
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return {
      job_id: job.id,
      status: errorCount > 0 && importedCount === 0 ? "failed" : "completed",
      imported_count: importedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      warning_count: warningCount,
      total_rows: rows.length,
      errors: errors.slice(0, 10),
      warnings: warnings.slice(0, 50),
    };
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
