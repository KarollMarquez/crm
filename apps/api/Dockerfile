# ── build stage ──────────────────────────────────────────────
FROM node:22-alpine AS builder
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

# Build the shared workspace package before NestJS resolves its dist entry point.
RUN pnpm --filter @crm/shared build
RUN pnpm --filter @crm/api build

# Keep Prisma's generated client in a stable path across pnpm virtual-store layouts.
RUN GENERATED_PRISMA_CLIENT="$(find /app -type d -path '*/node_modules/.prisma/client' -print -quit)" \
    && test -n "$GENERATED_PRISMA_CLIENT" \
    && cp -R "$GENERATED_PRISMA_CLIENT" /app/generated-prisma-client

# ── runtime stage ─────────────────────────────────────────────
FROM node:22-alpine AS runner
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
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/generated-prisma-client /app/generated-prisma-client

RUN PRISMA_PACKAGE="$(find /app/node_modules/.pnpm -type d -path '*/node_modules/@prisma/client' -print -quit)" \
    && test -n "$PRISMA_PACKAGE" \
    && PRISMA_NODE_MODULES="$(dirname "$(dirname "$PRISMA_PACKAGE")")" \
    && mkdir -p "$PRISMA_NODE_MODULES/.prisma" \
    && rm -rf "$PRISMA_NODE_MODULES/.prisma/client" \
    && cp -R /app/generated-prisma-client "$PRISMA_NODE_MODULES/.prisma/client"

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
