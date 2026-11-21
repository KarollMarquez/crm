import { Prisma, PrismaClient } from "@prisma/client";

/** Contacts 1000+, leads 2000+, stages 3000+, appointments 4000+. */
export const PUBLIC_NUMBER_START = 1000;

export const PUBLIC_NUMBER_STARTS = {
  contact: 1000,
  lead: 2000,
  stage: 3000,
  appointment: 4000,
} as const;

export type PublicNumberKind = keyof typeof PUBLIC_NUMBER_STARTS;

type DbClient = PrismaClient | Prisma.TransactionClient;

export function parsePublicNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

export async function allocatePublicNumber(
  db: DbClient,
  organizationId: string,
  kind: PublicNumberKind,
): Promise<number> {
  if (kind === "contact") {
    const org = await db.organization.update({
      where: { id: organizationId },
      data: { contactPublicSeq: { increment: 1 } },
      select: { contactPublicSeq: true },
    });
    return org.contactPublicSeq - 1;
  }
  if (kind === "lead") {
    const org = await db.organization.update({
      where: { id: organizationId },
      data: { leadPublicSeq: { increment: 1 } },
      select: { leadPublicSeq: true },
    });
    return org.leadPublicSeq - 1;
  }
  if (kind === "appointment") {
    const org = await db.organization.update({
      where: { id: organizationId },
      data: { appointmentPublicSeq: { increment: 1 } },
      select: { appointmentPublicSeq: true },
    });
    return org.appointmentPublicSeq - 1;
  }
  const org = await db.organization.update({
    where: { id: organizationId },
    data: { stagePublicSeq: { increment: 1 } },
    select: { stagePublicSeq: true },
  });
  return org.stagePublicSeq - 1;
}
