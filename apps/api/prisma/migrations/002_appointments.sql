-- Appointments calendar: citas with public numbers, linked to contact + lead.
-- Run against the CRM database, then: pnpm --filter @crm/api prisma:generate

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "appointmentPublicSeq" INTEGER NOT NULL DEFAULT 1000;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus') THEN
    CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'cancelled', 'completed', 'no_show');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Appointment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "publicNumber" INTEGER NOT NULL,
  "contactId" TEXT NOT NULL,
  "leadId" TEXT,
  "title" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
  "notes" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_organizationId_publicNumber_key"
  ON "Appointment" ("organizationId", "publicNumber");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_startsAt_idx"
  ON "Appointment" ("organizationId", "startsAt");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_contactId_idx"
  ON "Appointment" ("organizationId", "contactId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_organizationId_fkey') THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_contactId_fkey') THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_leadId_fkey') THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
