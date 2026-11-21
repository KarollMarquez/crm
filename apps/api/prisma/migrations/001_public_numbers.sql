-- Short per-organization display IDs for contacts, leads, and pipeline stages.
-- UUIDs/cuids stay as primary keys. Numbers start at 1000.
-- Run against the CRM database, then: pnpm --filter @crm/api prisma:generate

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "contactPublicSeq" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "leadPublicSeq" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "stagePublicSeq" INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "publicNumber" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "publicNumber" INTEGER;
ALTER TABLE "PipelineStage" ADD COLUMN IF NOT EXISTS "publicNumber" INTEGER;
ALTER TABLE "PipelineStage" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "PipelineStage" s
SET "organizationId" = p."organizationId"
FROM "Pipeline" p
WHERE s."pipelineId" = p."id"
  AND (s."organizationId" IS NULL OR s."organizationId" = '');

WITH numbered AS (
  SELECT
    id,
    999 + ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt" ASC, id ASC) AS n
  FROM "Contact"
  WHERE "publicNumber" IS NULL
)
UPDATE "Contact" c
SET "publicNumber" = numbered.n
FROM numbered
WHERE c.id = numbered.id;

WITH numbered AS (
  SELECT
    id,
    999 + ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt" ASC, id ASC) AS n
  FROM "Lead"
  WHERE "publicNumber" IS NULL
)
UPDATE "Lead" l
SET "publicNumber" = numbered.n
FROM numbered
WHERE l.id = numbered.id;

WITH numbered AS (
  SELECT
    s.id,
    999 + ROW_NUMBER() OVER (
      PARTITION BY p."organizationId"
      ORDER BY p."isDefault" DESC, s.position ASC, s.id ASC
    ) AS n
  FROM "PipelineStage" s
  JOIN "Pipeline" p ON p.id = s."pipelineId"
  WHERE s."publicNumber" IS NULL
)
UPDATE "PipelineStage" s
SET "publicNumber" = numbered.n
FROM numbered
WHERE s.id = numbered.id;

UPDATE "Organization" o
SET
  "contactPublicSeq" = COALESCE(
    (SELECT MAX(c."publicNumber") + 1 FROM "Contact" c WHERE c."organizationId" = o.id),
    1000
  ),
  "leadPublicSeq" = COALESCE(
    (SELECT MAX(l."publicNumber") + 1 FROM "Lead" l WHERE l."organizationId" = o.id),
    1000
  ),
  "stagePublicSeq" = COALESCE(
    (SELECT MAX(s."publicNumber") + 1 FROM "PipelineStage" s WHERE s."organizationId" = o.id),
    1000
  );

ALTER TABLE "Contact" ALTER COLUMN "publicNumber" SET NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "publicNumber" SET NOT NULL;
ALTER TABLE "PipelineStage" ALTER COLUMN "publicNumber" SET NOT NULL;
ALTER TABLE "PipelineStage" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Contact_organizationId_publicNumber_key"
  ON "Contact" ("organizationId", "publicNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_organizationId_publicNumber_key"
  ON "Lead" ("organizationId", "publicNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PipelineStage_organizationId_publicNumber_key"
  ON "PipelineStage" ("organizationId", "publicNumber");
CREATE INDEX IF NOT EXISTS "PipelineStage_organizationId_idx"
  ON "PipelineStage" ("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PipelineStage_organizationId_fkey'
  ) THEN
    ALTER TABLE "PipelineStage"
      ADD CONSTRAINT "PipelineStage_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
