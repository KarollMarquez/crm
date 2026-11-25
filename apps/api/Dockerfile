# ── build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma/      apps/api/prisma/
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/nest-cli.json apps/api/

# Install ALL deps (needed for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/api/src/ apps/api/src/

# Generate Prisma client
RUN pnpm --filter @crm/api prisma:generate

# Build NestJS
RUN pnpm --filter @crm/api build

# ── runtime stage ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma/      apps/api/prisma/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built output and generated prisma client
COPY --from=builder /app/apps/api/dist        apps/api/dist
COPY --from=builder /app/apps/api/node_modules/.prisma apps/api/node_modules/.prisma
COPY --from=builder /app/node_modules/.prisma          node_modules/.prisma

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
