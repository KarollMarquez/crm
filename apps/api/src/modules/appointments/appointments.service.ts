import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import { allocatePublicNumber, parsePublicNumber } from "../../common/public-number";
import { PrismaService } from "../../prisma/prisma.service";
import { ContactsService } from "../contacts/contacts.service";
import { LeadsService } from "../leads/leads.service";
import { OutboundService } from "../integrations/outbound.service";

const DEFAULT_DURATION_MS = 30 * 60 * 1000;
const BOOKED_STAGE = "cita_agendada";

const appointmentInclude = {
  contact: { select: { id: true, publicNumber: true, name: true, phone: true, email: true } },
  lead: {
    select: {
      id: true,
      publicNumber: true,
      status: true,
      stage: { select: { id: true, name: true, slug: true, color: true, publicNumber: true } },
    },
  },
} as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly leads: LeadsService,
    private readonly outbound: OutboundService,
  ) {}

  async list(
    organizationId: string,
    query?: { from?: string; to?: string; contactId?: string; status?: AppointmentStatus },
  ) {
    let contactId = query?.contactId;
    if (contactId) {
      const publicNumber = parsePublicNumber(contactId);
      const contact = await this.prisma.contact.findFirst({
        where: {
          organizationId,
          ...(publicNumber != null ? { OR: [{ id: contactId }, { publicNumber }] } : { id: contactId }),
        },
        select: { id: true },
      });
      contactId = contact?.id ?? "__none__";
    }
    return this.prisma.appointment.findMany({
      where: {
        organizationId,
        ...(query?.status ? { status: query.status } : {}),
        ...(contactId ? { contactId } : {}),
        ...(query?.from || query?.to
          ? {
              startsAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lt: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: appointmentInclude,
      orderBy: { startsAt: "asc" },
    });
  }

  async get(organizationId: string, id: string) {
    const appointment = await this.assertAppointment(organizationId, id);
    return this.prisma.appointment.findFirstOrThrow({
      where: { id: appointment.id, organizationId },
      include: appointmentInclude,
    });
  }

  async create(
    organizationId: string,
    input: {
      name: string;
      phone?: string;
      email?: string;
      startsAt: string;
      endsAt?: string;
      title?: string;
      notes?: string;
      source?: string;
    },
  ) {
    const startsAt = parseDate(input.startsAt, "startsAt");
    const endsAt = input.endsAt
      ? parseDate(input.endsAt, "endsAt")
      : new Date(startsAt.getTime() + DEFAULT_DURATION_MS);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException("endsAt must be after startsAt");
    }

    const contact = await this.contacts.upsertFromPatient(organizationId, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      source: input.source || "agenda",
    });

    const { lead } = await this.leads.ensureForContact(
      organizationId,
      contact.id,
      input.source || "agenda",
    );
    const bookedLead = await this.moveToBookedStage(organizationId, lead.id, lead.status);

    const publicNumber = await allocatePublicNumber(this.prisma, organizationId, "appointment");
    const appointment = await this.prisma.appointment.create({
      data: {
        organizationId,
        publicNumber,
        contactId: contact.id,
        leadId: bookedLead?.id || lead.id,
        title: input.title?.trim() || input.name.trim(),
        startsAt,
        endsAt,
        notes: input.notes?.trim() || null,
        source: input.source || "agenda",
        status: "scheduled",
      },
      include: appointmentInclude,
    });
    await this.outbound.emit(organizationId, "appointment.created", appointment);
    return appointment;
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      startsAt: string;
      endsAt: string;
      title: string | null;
      notes: string | null;
      status: AppointmentStatus;
    }>,
  ) {
    const appointment = await this.assertAppointment(organizationId, id);
    const startsAt = data.startsAt ? parseDate(data.startsAt, "startsAt") : appointment.startsAt;
    const duration = appointment.endsAt.getTime() - appointment.startsAt.getTime();
    const endsAt = data.endsAt
      ? parseDate(data.endsAt, "endsAt")
      : data.startsAt
        ? new Date(startsAt.getTime() + duration)
        : appointment.endsAt;
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException("endsAt must be after startsAt");
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startsAt: data.startsAt ? startsAt : undefined,
        endsAt: data.startsAt || data.endsAt ? endsAt : undefined,
        title: data.title === undefined ? undefined : data.title,
        notes: data.notes === undefined ? undefined : data.notes,
        status: data.status,
      },
      include: appointmentInclude,
    });
    await this.outbound.emit(organizationId, "appointment.updated", updated);
    return updated;
  }

  private async moveToBookedStage(organizationId: string, leadId: string, currentStatus?: string) {
    try {
      return await this.leads.update(organizationId, leadId, {
        stage: BOOKED_STAGE,
        ...(currentStatus === "lost" ? { status: "contacted" as const } : {}),
      });
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  private async assertAppointment(organizationId: string, id: string) {
    const publicNumber = parsePublicNumber(id);
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        organizationId,
        ...(publicNumber != null ? { OR: [{ id }, { publicNumber }] } : { id }),
      },
    });
    if (!appointment) throw new NotFoundException("Appointment not found");
    return appointment;
  }
}

function parseDate(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return date;
}
