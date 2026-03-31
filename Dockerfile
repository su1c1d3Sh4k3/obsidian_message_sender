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

# Build args for Vite (frontend env vars)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
