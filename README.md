# CRM + Chatwoot + WhatsApp + IA

Lightweight sales CRM connected to Chatwoot. Chatwoot is the source of truth for conversations; this app owns contacts, pipeline, automations, and AI.

## Stack

- Next.js + Tailwind (apps/web)
- NestJS + Prisma (apps/api)
- PostgreSQL + Redis/BullMQ

## Local setup

```bash
cp .env.example .env
cp .env.example apps/api/.env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:push
pnpm dev
```

- Web: http://localhost:3002 (3000 is Chatwoot)
- API: http://localhost:3001
