import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env from project root (parent of server/)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  UZAPI_URL: z.string().url(),
  UZAPI_ADMIN_TOKEN: z.string().min(1),
});

export const env = envSchema.parse(process.env);
