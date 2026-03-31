# ── Stage 1: Build frontend ────────────────────────
FROM node:20-alpine AS web-build

WORKDIR /app

# Copy root package files for workspaces
COPY package.json package-lock.json tsconfig.base.json ./
COPY web/package.json ./web/
COPY server/package.json ./server/

RUN npm ci

# Copy source
COPY web/ ./web/

# Hardcode Vite env vars for build (public keys only, safe to embed)
ENV VITE_SUPABASE_URL=https://esdumpabifhhoapemjbv.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZHVtcGFiaWZoaG9hcGVtamJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDAyNTIsImV4cCI6MjA5MDQ3NjI1Mn0.2nUhXoiesH7BXpnn9GP2uX1vMNDE6NZkOKTbu8tU568

RUN npm run build -w web

# ── Stage 2: Build server ──────────────────────────
FROM node:20-alpine AS server-build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

RUN npm ci

COPY server/ ./server/

RUN npm run build -w server

# ── Stage 3: Production ───────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

RUN npm ci --omit=dev

# Copy compiled server
COPY --from=server-build /app/server/dist ./server/dist

# Copy built frontend
COPY --from=web-build /app/web/dist ./web/dist

# Server will serve static files from web/dist
ENV NODE_ENV=production
ENV PORT=3333

EXPOSE 3333

CMD ["node", "server/dist/index.js"]
