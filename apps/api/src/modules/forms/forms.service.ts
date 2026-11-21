import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ContactsService } from "../contacts/contacts.service";
import { LeadsService } from "../leads/leads.service";
import { OutboundService } from "../integrations/outbound.service";

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly leads: LeadsService,
    private readonly outbound: OutboundService,
  ) {}

  list(organizationId: string) {
    return this.prisma.form.findMany({
      where: { organizationId },
      include: { _count: { select: { submissions: true } } },
    });
  }

  create(
    organizationId: string,
    input: {
      name: string;
      slug?: string;
      fields?: string[];
      tagIds?: string[];
      createDeal?: boolean;
      active?: boolean;
    },
  ) {
    const slug =
      input.slug ||
      input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return this.prisma.form.create({
      data: {
        organizationId,
        name: input.name,
        slug,
        fields: input.fields || ["name", "phone", "email", "service", "message"],
        tagIds: input.tagIds || [],
        createDeal: input.createDeal ?? true,
        active: input.active ?? true,
      },
    });
  }

  async publicGet(slug: string) {
    const form = await this.prisma.form.findFirst({ where: { slug, active: true } });
    if (!form) throw new NotFoundException("Form not found");
    return { id: form.id, name: form.name, slug: form.slug, fields: form.fields };
  }

  async submit(
    slug: string,
    payload: {
      name: string;
      phone?: string;
      email?: string;
      service?: string;
      message?: string;
    },
  ) {
    const form = await this.prisma.form.findFirst({ where: { slug, active: true } });
    if (!form) throw new NotFoundException("Form not found");
    const contact = await this.contacts.create(form.organizationId, {
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      source: `form:${form.slug}`,
      tagIds: (form.tagIds as string[]) || [],
    });
    const existingLead = await this.prisma.lead.findFirst({
      where: { organizationId: form.organizationId, contactId: contact.id },
      orderBy: { createdAt: "desc" },
    });
    if (existingLead) {
      await this.leads.update(form.organizationId, existingLead.id, {
        source: `form:${form.slug}`,
        service: payload.service,
      });
    } else {
      await this.leads.create(form.organizationId, {
        contactId: contact.id,
        source: `form:${form.slug}`,
        service: payload.service,
      });
    }
    if (payload.message) {
      await this.contacts.addNote(form.organizationId, contact.id, payload.message);
    }
    await this.prisma.formSubmission.create({
      data: {
        organizationId: form.organizationId,
        formId: form.id,
        contactId: contact.id,
        payload: payload as object,
      },
    });
    await this.outbound.emit(form.organizationId, "contact.created", contact);
    return { ok: true };
  }
}
