import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { allocatePublicNumber, parsePublicNumber } from "../../common/public-number";
import { normalizePhone, phoneDigits, phoneLookupVariants } from "../../common/phone";
import { PrismaService } from "../../prisma/prisma.service";
import { OutboundService } from "../integrations/outbound.service";
import { LeadsService } from "../leads/leads.service";

export { normalizePhone, phoneLookupVariants } from "../../common/phone";

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameScore(candidate: string, incoming: string) {
  const a = normalizeName(candidate);
  const b = normalizeName(incoming);
  if (!a || !b) return 0;
  if (a === b) return 4;
  if (a.includes(b) || b.includes(a)) return 3;
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const overlap = b.split(" ").filter((token) => tokensA.has(token)).length;
  return overlap;
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundService,
    private readonly leads: LeadsService,
  ) {}

  list(
    organizationId: string,
    query: {
      q?: string;
      tagId?: string;
      inboxId?: string;
      take?: number;
      phone?: string;
      email?: string;
      chatwootContactId?: string | number;
    },
  ) {
    const where: Prisma.ContactWhereInput = { organizationId };
    const and: Prisma.ContactWhereInput[] = [];
    if (query.q) {
      and.push({
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { email: { contains: query.q, mode: "insensitive" } },
          { phone: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }
    if (query.tagId) where.tags = { some: { tagId: query.tagId } };
    if (query.inboxId) {
      where.conversations = { some: { inboxId: query.inboxId } };
    }
    if (query.email?.trim()) {
      where.email = { equals: query.email.trim(), mode: "insensitive" };
    }
    if (query.phone?.trim()) {
      const variants = phoneLookupVariants(query.phone);
      and.push({
        OR: variants.map((value) => ({ phone: { contains: value, mode: "insensitive" as const } })),
      });
    }
    if (query.chatwootContactId !== undefined && query.chatwootContactId !== "") {
      const chatwootId = Number(query.chatwootContactId);
      if (!Number.isFinite(chatwootId)) {
        where.id = "__invalid__";
      } else {
        where.chatwootLink = { chatwootContactId: chatwootId };
      }
    }
    if (and.length) where.AND = and;
    return this.prisma.contact.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
        chatwootLink: true,
        customFields: true,
        leads: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { stage: true, owner: { select: { id: true, name: true } } },
        },
        deals: { include: { stage: true }, take: 1, orderBy: { updatedAt: "desc" } },
        conversations: { orderBy: { lastMessageAt: "desc" }, take: 1, include: { inbox: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: query.take || 100,
    });
  }

  private async contactId(organizationId: string, id: string) {
    const publicNumber = parsePublicNumber(id);
    const found = await this.prisma.contact.findFirst({
      where: {
        organizationId,
        ...(publicNumber != null ? { OR: [{ id }, { publicNumber }] } : { id }),
      },
      select: { id: true },
    });
    if (!found) throw new NotFoundException("Contact not found");
    return found.id;
  }

  async get(organizationId: string, id: string) {
    const contactId = await this.contactId(organizationId, id);
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: {
        tags: { include: { tag: true } },
        notes: { orderBy: { createdAt: "desc" } },
        customFields: true,
        leads: {
          orderBy: { createdAt: "desc" },
          include: { stage: true, owner: { select: { id: true, name: true } }, customFields: true },
        },
        deals: { include: { stage: true, pipeline: true } },
        tasks: { orderBy: { dueAt: "asc" } },
        conversations: { include: { inbox: true }, orderBy: { lastMessageAt: "desc" } },
        appointments: { orderBy: { startsAt: "desc" }, take: 20 },
        chatwootLink: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!contact) throw new NotFoundException("Contact not found");
    return contact;
  }

  async findMatch(
    organizationId: string,
    input: { name?: string; phone?: string; email?: string },
  ) {
    const phone = input.phone?.trim();
    if (phone) {
      const variants = phoneLookupVariants(phone);
      const incomingDigits = phoneDigits(phone);
      const last10 = incomingDigits.length >= 10 ? incomingDigits.slice(-10) : incomingDigits;
      const found = await this.prisma.contact.findMany({
        where: {
          organizationId,
          OR: variants.map((value) => ({
            phone: { contains: value, mode: "insensitive" as const },
          })),
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      });
      const matches = found.filter((contact) => {
        const digits = phoneDigits(contact.phone);
        if (!digits || !last10) return false;
        return digits.endsWith(last10) || last10.endsWith(digits.slice(-Math.min(10, digits.length)));
      });
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) {
        const named = [...matches].sort(
          (a, b) => nameScore(b.name, input.name || "") - nameScore(a.name, input.name || ""),
        );
        return named[0];
      }
    }

    const email = input.email?.trim();
    if (email) {
      const byEmail = await this.prisma.contact.findFirst({
        where: { organizationId, email: { equals: email, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
      });
      if (byEmail) return byEmail;
    }

    const name = input.name?.trim();
    if (name) {
      const byName = await this.prisma.contact.findFirst({
        where: { organizationId, name: { equals: name, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
      });
      if (byName) return byName;
    }

    return null;
  }

  async upsertFromPatient(
    organizationId: string,
    input: { name: string; phone?: string; email?: string; source?: string },
  ) {
    const phone = normalizePhone(input.phone) || undefined;
    const existing = await this.findMatch(organizationId, {
      name: input.name,
      phone: phone || input.phone,
      email: input.email,
    });
    if (!existing) {
      return this.create(organizationId, {
        name: input.name.trim(),
        phone,
        email: input.email?.trim() || undefined,
        source: input.source || "agenda",
      });
    }

    const patch: { name?: string; phone?: string; email?: string } = {};
    const name = input.name.trim();
    const email = input.email?.trim();
    if (name && name !== existing.name) patch.name = name;
    if (phone && phone !== (existing.phone || "")) patch.phone = phone;
    if (email && email !== (existing.email || "")) patch.email = email;
    if (!Object.keys(patch).length) return existing;
    return this.update(organizationId, existing.id, patch);
  }

  async create(
    organizationId: string,
    input: {
      name: string;
      email?: string;
      phone?: string;
      source?: string;
      ownerId?: string;
      tagIds?: string[];
    },
  ) {
    const publicNumber = await allocatePublicNumber(this.prisma, organizationId, "contact");
    const contact = await this.prisma.contact.create({
      data: {
        organizationId,
        publicNumber,
        name: input.name,
        email: input.email || null,
        phone: normalizePhone(input.phone),
        source: input.source,
        ownerId: input.ownerId,
        tags: input.tagIds
          ? { create: input.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });
    await this.outbound.emit(organizationId, "contact.created", contact);
    await this.leads.create(organizationId, {
      contactId: contact.id,
      source: input.source || "manual",
      status: "new",
      ownerId: input.ownerId,
    });
    return contact;
  }

  async update(
    organizationId: string,
    id: string,
    input: {
      name?: string;
      email?: string;
      phone?: string;
      source?: string;
      ownerId?: string;
      tagIds?: string[];
    },
  ) {
    const contactId = await this.contactId(organizationId, id);
    if (input.tagIds) {
      await this.prisma.contactTag.deleteMany({ where: { contactId } });
      if (input.tagIds.length) {
        await this.prisma.contactTag.createMany({
          data: input.tagIds.map((tagId) => ({ contactId, tagId })),
        });
      }
    }
    const contact = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone !== undefined ? normalizePhone(input.phone) : undefined,
        source: input.source,
        ownerId: input.ownerId,
      },
      include: { tags: { include: { tag: true } } },
    });
    await this.outbound.emit(organizationId, "contact.updated", contact);
    return contact;
  }

  async addNote(organizationId: string, contactId: string, body: string) {
    const id = await this.contactId(organizationId, contactId);
    return this.prisma.contactNote.create({
      data: { organizationId, contactId: id, body },
    });
  }

  async addTag(organizationId: string, contactId: string, tagId: string) {
    const id = await this.contactId(organizationId, contactId);
    await this.prisma.contactTag.createMany({
      data: [{ contactId: id, tagId }],
      skipDuplicates: true,
    });
    return this.prisma.contactTag.findUniqueOrThrow({
      where: { contactId_tagId: { contactId: id, tagId } },
      include: { tag: true },
    });
  }

  async addTagByName(organizationId: string, contactId: string, name: string) {
    const id = await this.contactId(organizationId, contactId);
    const tagName = name.trim();
    const tag = await this.prisma.tag.upsert({
      where: { organizationId_name: { organizationId, name: tagName } },
      create: { organizationId, name: tagName, color: "#6366f1" },
      update: {},
    });
    await this.prisma.contactTag.createMany({
      data: [{ contactId: id, tagId: tag.id }],
      skipDuplicates: true,
    });
    return tag;
  }

  async setField(organizationId: string, contactId: string, key: string, value: string) {
    const id = await this.contactId(organizationId, contactId);
    return this.prisma.contactCustomField.upsert({
      where: { contactId_key: { contactId: id, key } },
      create: { organizationId, contactId: id, key, value },
      update: { value },
    });
  }

  async deleteField(organizationId: string, contactId: string, fieldId: string) {
    const id = await this.contactId(organizationId, contactId);
    return this.prisma.contactCustomField.deleteMany({
      where: { id: fieldId, contactId: id, organizationId },
    });
  }

  async removeTag(organizationId: string, contactId: string, tagId: string) {
    const id = await this.contactId(organizationId, contactId);
    const tag = await this.prisma.tag.findFirst({
      where: { organizationId, OR: [{ id: tagId }, { name: tagId }] },
      select: { id: true },
    });
    if (!tag) throw new NotFoundException("Tag not found");
    return this.prisma.contactTag.delete({
      where: { contactId_tagId: { contactId: id, tagId: tag.id } },
    });
  }

  async delete(organizationId: string, id: string) {
    const contactId = await this.contactId(organizationId, id);
    await this.prisma.$transaction(async (tx) => {
      const deals = await tx.deal.findMany({ where: { contactId }, select: { id: true } });
      const dealIds = deals.map((deal) => deal.id);
      await tx.task.updateMany({ where: { contactId }, data: { contactId: null } });
      if (dealIds.length) {
        await tx.task.updateMany({ where: { dealId: { in: dealIds } }, data: { dealId: null } });
      }
      await tx.formSubmission.updateMany({ where: { contactId }, data: { contactId: null } });
      await tx.deal.updateMany({ where: { contactId }, data: { leadId: null } });
      await tx.deal.deleteMany({ where: { contactId } });
      await tx.lead.deleteMany({ where: { contactId } });
      await tx.contact.delete({ where: { id: contactId } });
    });
    return { ok: true };
  }
}
