import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://esdumpabifhhoapemjbv.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZHVtcGFiaWZoaG9hcGVtamJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDkwMDI1MiwiZXhwIjoyMDkwNDc2MjUyfQ.jddkCSTrpAs0Va6rBfFed00ig68eKlV2e31PN6gHK6o";

const sql = readFileSync("schema.sql", "utf8");

// Split into individual statements
const statements = sql
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`Found ${statements.length} SQL statements to execute.\n`);

// Use pg-meta query endpoint (same one used by Supabase Dashboard SQL Editor)
async function runSQL(query) {
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "x-connection-encrypted": "true",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

// Try running the full schema at once first
try {
  console.log("Executing full schema...");
  const result = await runSQL(sql);
  console.log("Schema executed successfully!");
  console.log(JSON.stringify(result, null, 2).substring(0, 500));
} catch (err) {
  console.error("Full schema failed:", err.message);
  console.log("\nTrying statement by statement...\n");

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, " ");
    try {
      await runSQL(stmt);
      console.log(`[${i + 1}/${statements.length}] OK: ${preview}...`);
    } catch (e) {
      console.error(`[${i + 1}/${statements.length}] FAIL: ${preview}...`);
      console.error(`  Error: ${e.message}\n`);
    }
  }
}
