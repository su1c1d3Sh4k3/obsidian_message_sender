import { readFileSync } from "fs";

const SUPABASE_URL = "https://esdumpabifhhoapemjbv.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZHVtcGFiaWZoaG9hcGVtamJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDkwMDI1MiwiZXhwIjoyMDkwNDc2MjUyfQ.jddkCSTrpAs0Va6rBfFed00ig68eKlV2e31PN6gHK6o";

const sql = readFileSync("scripts/migrate-birthday.sql", "utf8");

// Split statements and run one by one via PostgREST rpc
const statements = sql
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

// Try multiple Supabase SQL endpoints
const endpoints = [
  "/pg/query",
  "/rest/v1/rpc/exec_sql",
];

async function tryRunSQL(query) {
  // Method 1: pg/query with x-connection-encrypted
  for (const path of ["/pg/query"]) {
    try {
      const res = await fetch(`${SUPABASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "x-connection-encrypted": "true",
        },
        body: JSON.stringify({ query }),
      });
      if (res.ok) return await res.json();
    } catch {}
  }

  // Method 2: Direct PostgreSQL via Supabase pooler (not available via REST)
  // Fallback: print the SQL to run manually
  throw new Error("Could not find working SQL endpoint");
}

console.log("Attempting to run migration...\n");
console.log("If automatic execution fails, run this SQL in the Supabase Dashboard SQL Editor:\n");
console.log("=".repeat(60));
console.log(sql);
console.log("=".repeat(60));
console.log();

try {
  const result = await tryRunSQL(sql);
  console.log("Migration executed successfully!");
  console.log(JSON.stringify(result, null, 2).substring(0, 500));
} catch (err) {
  console.log(`Auto-execution failed: ${err.message}`);
  console.log("\nPlease copy the SQL above and run it in:");
  console.log(`  ${SUPABASE_URL} → SQL Editor → New Query → Paste → Run`);
}
