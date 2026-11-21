-- Distinct public number ranges so contact/lead/stage/appointment IDs never collide visually.
-- Contacts 1000+, leads 2000+, stages 3000+, appointments 4000+.
-- Run against the CRM database.

ALTER TABLE "Organization"
  ALTER COLUMN "leadPublicSeq" SET DEFAULT 2000,
  ALTER COLUMN "stagePublicSeq" SET DEFAULT 3000,
  ALTER COLUMN "appointmentPublicSeq" SET DEFAULT 4000;

-- Remumber leads into 2000+
WITH numbered AS (
  SELECT
    id,
    1999 + ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt" ASC, id ASC) AS n
  FROM "Lead"
)
UPDATE "Lead" l
SET "publicNumber" = numbered.n
FROM numbered
WHERE l.id = numbered.id;

-- Remumber stages into 3000+
WITH numbered AS (
  SELECT
    id,
    2999 + ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "position" ASC, id ASC) AS n
  FROM "PipelineStage"
)
UPDATE "PipelineStage" s
SET "publicNumber" = numbered.n
FROM numbered
WHERE s.id = numbered.id;

-- Remumber appointments into 4000+ (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Appointment'
  ) THEN
    WITH numbered AS (
      SELECT
        id,
        3999 + ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt" ASC, id ASC) AS n
      FROM "Appointment"
    )
    UPDATE "Appointment" a
    SET "publicNumber" = numbered.n
    FROM numbered
    WHERE a.id = numbered.id;
  END IF;
END $$;

UPDATE "Organization" o
SET
  "leadPublicSeq" = COALESCE(
    (SELECT MAX(l."publicNumber") + 1 FROM "Lead" l WHERE l."organizationId" = o.id),
    2000
  ),
  "stagePublicSeq" = COALESCE(
    (SELECT MAX(s."publicNumber") + 1 FROM "PipelineStage" s WHERE s."organizationId" = o.id),
    3000
  ),
  "appointmentPublicSeq" = COALESCE(
    (
      SELECT MAX(a."publicNumber") + 1
      FROM "Appointment" a
      WHERE a."organizationId" = o.id
    ),
    4000
  );
