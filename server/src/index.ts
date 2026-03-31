import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/routes.js";
import { contactsRoutes } from "./modules/contacts/routes.js";
import { tagsRoutes } from "./modules/tags/routes.js";
import { listsRoutes } from "./modules/lists/routes.js";
import { sendersRoutes } from "./modules/senders/routes.js";
import { campaignsRoutes } from "./modules/campaigns/routes.js";
import { importRoutes } from "./modules/import/routes.js";
import { settingsRoutes } from "./modules/settings/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { recoverRunningCampaigns, startScheduleChecker } from "./workers/campaign-dispatcher.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
await app.register(multipart, { limits: { fileSize: 52_428_800 } }); // 50MB

// Routes
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(contactsRoutes, { prefix: "/api/contacts" });
await app.register(tagsRoutes, { prefix: "/api/tags" });
await app.register(listsRoutes, { prefix: "/api/lists" });
await app.register(sendersRoutes, { prefix: "/api/senders" });
await app.register(campaignsRoutes, { prefix: "/api/campaigns" });
await app.register(importRoutes, { prefix: "/api/import" });
await app.register(settingsRoutes, { prefix: "/api/settings" });
await app.register(adminRoutes, { prefix: "/api/admin" });

// Health check
app.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.join(__dirname, "../../web/dist");

  await app.register(fastifyStatic, {
    root: webDist,
    prefix: "/",
    wildcard: false,
  });

  // SPA fallback: serve index.html for non-API routes
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`Server running on http://localhost:${env.PORT}`);

  // Recover campaigns that were running before server restart
  recoverRunningCampaigns().catch((err) => {
    console.error("[dispatcher] Recovery failed:", err);
  });

  // Start scheduled campaign checker
  startScheduleChecker();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
