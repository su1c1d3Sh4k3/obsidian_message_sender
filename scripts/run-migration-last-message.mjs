import { readFileSync } from "fs";

const SUPABASE_URL = "https://esdumpabifhhoapemjbv.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZHVtcGFiaWZoaG9hcGVtamJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDkwMDI1MiwiZXhwIjoyMDkwNDc2MjUyfQ.jddkCSTrpAs0Va6rBfFed00ig68eKlV2e31PN6gHK6o";

const sql = readFileSync("scripts/migrate-last-message.sql", "utf8");

async function tryRunSQL(query) {
  try {
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
    if (res.ok) return await res.json();
  } catch {}

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
