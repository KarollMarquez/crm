import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret, encryptSecret, randomToken } from "../../common/crypto";
import { QUEUE } from "../../queue/queue.module";
import { OutboundService } from "../integrations/outbound.service";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { AuditService } from "../../common/audit.service";
import { LeadsService } from "../leads/leads.service";
import { allocatePublicNumber } from "../../common/public-number";
import { normalizePhone } from "../../common/phone";

type ChatwootAccount = { id: number; name: string };
type ChatwootInbox = { id: number; name: string; channel_type: string; phone_number?: string };
type ChatwootContact = {
  id: number;
  name?: string;
  email?: string;
  phone_number?: string;
  identifier?: string;
};
type ChatwootAttachment = {
  id?: number;
  file_type?: string;
  content_type?: string;
  data_url?: string;
  thumb_url?: string;
  file_url?: string;
  file_size?: number;
  filename?: string;
  extension?: string;
  meta?: { filename?: string };
};

type ChatwootMessage = {
  id: number;
  content?: string;
  message_type?: number | string;
  created_at?: number | string;
  private?: boolean;
  sender?: { name?: string; type?: string };
  attachments?: ChatwootAttachment[];
};

export type UploadedMedia = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type ChatwootConversation = {
  id: number;
  inbox_id?: number;
  status?: string;
  timestamp?: number;
  unread_count?: number;
  labels?: string[];
  last_non_activity_message?: ChatwootMessage;
  messages?: ChatwootMessage[];
  meta?: {
    sender?: ChatwootContact & { thumbnail?: string };
    assignee?: { id?: number; name?: string; available_name?: string };
  };
};

@Injectable()
export class ChatwootService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundService,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
    private readonly leads: LeadsService,
    @InjectQueue(QUEUE.CHATWOOT_SYNC) private readonly syncQueue: Queue,
    @InjectQueue(QUEUE.AI) private readonly aiQueue: Queue,
    @InjectQueue(QUEUE.AUTOMATIONS) private readonly automationQueue: Queue,
  ) {}

  private async creds(organizationId: string) {
    const conn = await this.prisma.chatwootConnection.findUnique({
      where: { organizationId },
    });
    if (!conn?.connected) throw new BadRequestException("Chatwoot is not connected");
    return {
      ...conn,
      token: decryptSecret(conn.encryptedToken),
    };
  }

  private async request<T>(
    baseUrl: string,
    token: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${baseUrl.replace(/\/$/, "")}${path}`;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          headers: {
            api_access_token: token,
            "Content-Type": "application/json",
            ...(init.headers || {}),
          },
        });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status} ${text}`);
        }
        if (res.status === 204) return {} as T;
        return (await res.json()) as T;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw new BadGatewayException(
      `Chatwoot temporalmente no disponible: ${String(lastError)}`,
    );
  }

  private async requestForm<T>(baseUrl: string, token: string, path: string, form: FormData): Promise<T> {
    const url = `${baseUrl.replace(/\/$/, "")}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { api_access_token: token },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadGatewayException(`Chatwoot temporalmente no disponible: ${res.status} ${text}`);
    }
    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  }

  private normalizeFileType(att: ChatwootAttachment) {
    const type = String(att.file_type || "").toLowerCase();
    if (type === "ig_reel") return "video";
    if (type) return type;
    const mime = String(att.content_type || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("video/")) return "video";
    return "file";
  }

  private clientMediaUrl(url: string | null | undefined, baseUrl: string) {
    if (!url) return null;
    const absolute = url.startsWith("/")
      ? `${baseUrl.replace(/\/$/, "")}${url}`
      : url;
    try {
      const parsed = new URL(absolute);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      const host = new URL(baseUrl).hostname;
      if (parsed.hostname === host) {
        return `/api/chatwoot/attachments?url=${encodeURIComponent(parsed.toString())}`;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private mapAttachment(att: ChatwootAttachment, baseUrl: string) {
    const fileType = this.normalizeFileType(att);
    const dataUrl = att.data_url || att.file_url || null;
    return {
      id: att.id,
      fileType,
      filename:
        att.filename ||
        att.meta?.filename ||
        (att.extension ? `archivo.${att.extension}` : null),
      fileSize: att.file_size ?? null,
      dataUrl: this.clientMediaUrl(dataUrl, baseUrl),
      thumbUrl: this.clientMediaUrl(att.thumb_url, baseUrl),
    };
  }

  private mapMessage(message: ChatwootMessage, baseUrl: string) {
    return {
      id: message.id,
      content: message.content,
      message_type: message.message_type,
      created_at: message.created_at,
      private: message.private,
      sender: message.sender,
      attachments: (message.attachments || []).map((att) => this.mapAttachment(att, baseUrl)),
    };
  }

  private messagePreview(msg?: ChatwootMessage | null) {
    const text = msg?.content?.trim();
    if (text) return text.slice(0, 180);
    const types = (msg?.attachments || []).map((att) => this.normalizeFileType(att));
    if (types.includes("image")) return "Imagen";
    if (types.includes("video") || types.includes("ig_reel")) return "Video";
    if (types.includes("audio")) return "Audio";
    if (types.includes("sticker")) return "Sticker";
    if (types.length) return "Archivo";
    return null;
  }

  private assertSafeAttachmentUrl(rawUrl: string, baseUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException("Invalid attachment url");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new BadRequestException("Invalid attachment url");
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException("Invalid attachment url");
    }
    const allowed = new URL(baseUrl);
    if (parsed.hostname !== allowed.hostname) {
      throw new BadRequestException("Attachment url is not allowed");
    }
    return parsed.toString();
  }

  async connect(
    organizationId: string,
    userId: string,
    input: { baseUrl: string; accountId: string; apiAccessToken: string },
  ) {
    const base = input.baseUrl.replace(/\/$/, "");
    const account = await this.request<ChatwootAccount>(
      base,
      input.apiAccessToken,
      `/api/v1/accounts/${input.accountId}`,
    );
    const inboxesRes = await this.request<{ payload?: ChatwootInbox[] } | ChatwootInbox[]>(
      base,
      input.apiAccessToken,
      `/api/v1/accounts/${input.accountId}/inboxes`,
    );
    const inboxes = Array.isArray(inboxesRes)
      ? inboxesRes
      : inboxesRes.payload || [];

    const webhookSecret = randomToken(16);
    const conn = await this.prisma.chatwootConnection.upsert({
      where: { organizationId },
      create: {
        organizationId,
        baseUrl: base,
        accountId: input.accountId,
        encryptedToken: encryptSecret(input.apiAccessToken),
        accountName: account.name,
        webhookSecret,
        connected: true,
        lastError: null,
      },
      update: {
        baseUrl: base,
        accountId: input.accountId,
        encryptedToken: encryptSecret(input.apiAccessToken),
        accountName: account.name,
        connected: true,
        lastError: null,
      },
    });

    await this.prisma.chatwootInbox.deleteMany({ where: { organizationId } });
    if (inboxes.length) {
      await this.prisma.chatwootInbox.createMany({
        data: inboxes.map((inbox) => ({
          organizationId,
          chatwootInboxId: inbox.id,
          name: inbox.name,
          channelType: inbox.channel_type || "Channel::Api",
          phoneNumber: inbox.phone_number,
        })),
      });
    }

    const webhookUrl = `${process.env.API_URL || "http://localhost:3001"}/api/webhooks/chatwoot`;
    try {
      await this.request(base, input.apiAccessToken, `/api/v1/accounts/${input.accountId}/webhooks`, {
        method: "POST",
        body: JSON.stringify({
          webhook: {
            url: webhookUrl,
            subscriptions: [
              "contact_created",
              "contact_updated",
              "conversation_created",
              "conversation_updated",
              "conversation_status_changed",
              "message_created",
            ],
          },
        }),
      });
    } catch {
      // User may register the webhook manually if Chatwoot rejects auto-create.
    }

    await this.syncQueue.add("contacts", { organizationId });
    await this.audit.log({
      organizationId,
      actorUserId: userId,
      action: "chatwoot.connected",
      entity: "chatwoot_connection",
      entityId: conn.id,
    });

    return this.getStatus(organizationId);
  }

  async disconnect(organizationId: string, userId: string) {
    await this.prisma.chatwootConnection.updateMany({
      where: { organizationId },
      data: { connected: false, encryptedToken: encryptSecret("revoked") },
    });
    await this.audit.log({
      organizationId,
      actorUserId: userId,
      action: "chatwoot.disconnected",
      entity: "chatwoot_connection",
    });
    return { connected: false };
  }

  async getStatus(organizationId: string) {
    const conn = await this.prisma.chatwootConnection.findUnique({
      where: { organizationId },
    });
    const inboxes = await this.prisma.chatwootInbox.findMany({
      where: { organizationId },
    });
    if (!conn) return { connected: false, inboxes: [] };
    return {
      connected: conn.connected,
      accountName: conn.accountName,
      accountId: conn.accountId,
      baseUrl: conn.baseUrl,
      lastSyncAt: conn.lastSyncAt,
      lastError: conn.lastError,
      inboxes,
    };
  }

  async syncContacts(organizationId: string) {
    const { baseUrl, token, accountId } = await this.creds(organizationId);
    let page = 1;
    let imported = 0;
    while (page < 50) {
      const res = await this.request<{ payload?: ChatwootContact[]; meta?: { count?: number } }>(
        baseUrl,
        token,
        `/api/v1/accounts/${accountId}/contacts?page=${page}`,
      );
      const list = res.payload || [];
      if (!list.length) break;
      for (const cw of list) {
        const contactId = await this.upsertContact(organizationId, cw);
        await this.syncContactConversations(organizationId, cw.id, contactId);
        imported += 1;
      }
      if (list.length < 15) break;
      page += 1;
    }
    await this.syncAccountConversations(organizationId);
    await this.prisma.chatwootConnection.update({
      where: { organizationId },
      data: { lastSyncAt: new Date(), lastError: null },
    });
    return { imported };
  }

  private async syncContactConversations(
    organizationId: string,
    chatwootContactId: number,
    contactId: string,
  ) {
    try {
      const { baseUrl, token, accountId } = await this.creds(organizationId);
      const res = await this.request<unknown>(
        baseUrl,
        token,
        `/api/v1/accounts/${accountId}/contacts/${chatwootContactId}/conversations`,
      );
      for (const conv of this.extractConversations(res)) {
        await this.hydrateConversation(organizationId, conv, contactId);
      }
    } catch (err) {
      console.warn(`Chatwoot conversations sync failed for contact ${chatwootContactId}`, err);
    }
  }

  private async syncAccountConversations(organizationId: string) {
    try {
      const { baseUrl, token, accountId } = await this.creds(organizationId);
      for (let page = 1; page <= 10; page += 1) {
        const res = await this.request<unknown>(
          baseUrl,
          token,
          `/api/v1/accounts/${accountId}/conversations?status=all&page=${page}`,
        );
        const list = this.extractConversations(res);
        if (!list.length) break;
        for (const conv of list) {
          await this.hydrateConversation(organizationId, conv);
        }
        if (list.length < 15) break;
      }
    } catch (err) {
      console.warn("Chatwoot account conversations sync failed", err);
    }
  }

  async upsertContact(organizationId: string, cw: ChatwootContact) {
    const existing = await this.prisma.chatwootContactLink.findUnique({
      where: {
        organizationId_chatwootContactId: {
          organizationId,
          chatwootContactId: cw.id,
        },
      },
    });
    const phone = normalizePhone(cw.phone_number);
    const data = {
      name: cw.name || phone || cw.phone_number || cw.email || `Contacto ${cw.id}`,
      email: cw.email || null,
      phone,
      source: "chatwoot",
    };
    if (existing) {
      await this.prisma.contact.update({
        where: { id: existing.contactId },
        data,
      });
      await this.ensureLead(organizationId, existing.contactId, "chatwoot");
      return existing.contactId;
    }
    const publicNumber = await allocatePublicNumber(this.prisma, organizationId, "contact");
    const contact = await this.prisma.contact.create({
      data: { organizationId, publicNumber, ...data },
    });
    await this.prisma.chatwootContactLink.create({
      data: {
        organizationId,
        contactId: contact.id,
        chatwootContactId: cw.id,
        identifier: cw.identifier,
      },
    });
    await this.ensureLead(organizationId, contact.id, "chatwoot");
    await this.outbound.emit(organizationId, "contact.created", {
      id: contact.id,
      ...data,
    });
    return contact.id;
  }

  async listInbox(
    organizationId: string,
    query: { status?: string; q?: string; inboxId?: string; assignee?: string },
  ) {
    const cached = await this.cachedInbox(organizationId, query);
    try {
      const { baseUrl, token, accountId } = await this.creds(organizationId);
      const params = new URLSearchParams();
      params.set("status", query.status && query.status !== "all" ? query.status : "all");
      if (query.assignee === "mine") params.set("assignee_type", "me");
      if (query.assignee === "unassigned") params.set("assignee_type", "unassigned");
      if (query.q) params.set("q", query.q);
      if (query.inboxId) {
        const inbox = await this.prisma.chatwootInbox.findFirst({
          where: { id: query.inboxId, organizationId },
        });
        if (inbox) params.set("inbox_id", String(inbox.chatwootInboxId));
      }
      const res = await this.request<unknown>(
        baseUrl,
        token,
        `/api/v1/accounts/${accountId}/conversations?${params.toString()}`,
      );
      const raw = this.extractConversations(res);
      const live = [];
      for (const conv of raw) {
        if (!conv?.id) continue;
        live.push(await this.hydrateConversation(organizationId, conv));
      }
      if (!live.length) {
        return { conversations: cached, source: "cache" as const };
      }
      const seen = new Set(live.map((c) => c.chatwootConversationId));
      const merged = [...live, ...cached.filter((c) => !seen.has(c.chatwootConversationId))];
      return { conversations: merged, source: "live" as const };
    } catch {
      return { conversations: cached, source: "cache" as const, unavailable: true };
    }
  }

  private extractConversations(res: unknown): ChatwootConversation[] {
    if (Array.isArray(res)) return res as ChatwootConversation[];
    if (!res || typeof res !== "object") return [];
    const obj = res as {
      data?: { payload?: ChatwootConversation[] };
      payload?: ChatwootConversation[] | { conversations?: ChatwootConversation[] };
      conversations?: ChatwootConversation[];
    };
    if (Array.isArray(obj.data?.payload)) return obj.data.payload;
    if (Array.isArray(obj.payload)) return obj.payload;
    if (obj.payload && !Array.isArray(obj.payload) && Array.isArray(obj.payload.conversations)) {
      return obj.payload.conversations;
    }
    if (Array.isArray(obj.conversations)) return obj.conversations;
    return [];
  }

  private async cachedInbox(
    organizationId: string,
    query: { status?: string; q?: string; inboxId?: string; assignee?: string },
  ) {
    const rows = await this.prisma.chatwootConversationLink.findMany({
      where: {
        organizationId,
        ...(query.inboxId ? { inboxId: query.inboxId } : {}),
        ...(query.status && query.status !== "all" ? { status: query.status } : {}),
        ...(query.assignee === "unassigned" ? { assigneeName: null } : {}),
        ...(query.q
          ? {
              OR: [
                { lastMessagePreview: { contains: query.q, mode: "insensitive" } },
                { contact: { name: { contains: query.q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        inbox: true,
        contact: {
          include: {
            tags: { include: { tag: true } },
            leads: { include: { stage: true }, take: 1, orderBy: { updatedAt: "desc" } },
            deals: { include: { stage: true }, take: 1, orderBy: { updatedAt: "desc" } },
          },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 80,
    });
    return rows.map((row) => ({
      chatwootConversationId: row.chatwootConversationId,
      status: row.status,
      unreadCount: row.unreadCount,
      lastMessagePreview: row.lastMessagePreview,
      lastMessageAt: row.lastMessageAt,
      assigneeName: row.assigneeName,
      labels: [] as string[],
      inbox: row.inbox
        ? { id: row.inbox.id, name: row.inbox.name, channelType: row.inbox.channelType }
        : null,
      contact: {
        id: row.contact.id,
        name: row.contact.name,
        email: row.contact.email,
        phone: row.contact.phone,
        createdAt: row.contact.createdAt,
        tags: row.contact.tags.map((t) => t.tag),
        stage: row.contact.leads[0]?.stage?.name || row.contact.deals[0]?.stage?.name || null,
      },
    }));
  }

  private async hydrateConversation(
    organizationId: string,
    conv: ChatwootConversation,
    fallbackContactId?: string,
  ) {
    if (!conv?.id) {
      return {
        chatwootConversationId: 0,
        status: "open",
        unreadCount: 0,
        lastMessagePreview: null,
        lastMessageAt: null,
        assigneeName: null,
        labels: [] as string[],
        inbox: null,
        contact: {
          id: fallbackContactId || "",
          name: "Contacto",
          email: null,
          phone: null,
          createdAt: null,
          tags: [],
          stage: null,
        },
      };
    }
    const sender = conv.meta?.sender;
    let contactId = fallbackContactId;
    if (sender?.id) contactId = await this.upsertContact(organizationId, sender);
    const inbox = conv.inbox_id
      ? await this.prisma.chatwootInbox.findUnique({
          where: {
            organizationId_chatwootInboxId: {
              organizationId,
              chatwootInboxId: conv.inbox_id,
            },
          },
        })
      : null;
    const last = conv.last_non_activity_message || conv.messages?.at(-1);
    const lastAt = last?.created_at
      ? new Date(typeof last.created_at === "number" ? last.created_at * 1000 : last.created_at)
      : conv.timestamp
        ? new Date(conv.timestamp * 1000)
        : new Date();
    if (contactId) {
      await this.prisma.chatwootConversationLink.upsert({
        where: {
          organizationId_chatwootConversationId: {
            organizationId,
            chatwootConversationId: conv.id,
          },
        },
        create: {
          organizationId,
          contactId,
          inboxId: inbox?.id,
          chatwootConversationId: conv.id,
          status: conv.status || "open",
          lastMessagePreview: this.messagePreview(last),
          lastMessageAt: lastAt,
          unreadCount: conv.unread_count || 0,
          assigneeName: conv.meta?.assignee?.available_name || conv.meta?.assignee?.name,
        },
        update: {
          status: conv.status || undefined,
          lastMessagePreview: this.messagePreview(last),
          lastMessageAt: lastAt,
          unreadCount: conv.unread_count || 0,
          assigneeName: conv.meta?.assignee?.available_name || conv.meta?.assignee?.name,
          inboxId: inbox?.id,
        },
      });
    }
    const crm = contactId
      ? await this.prisma.contact.findUnique({
          where: { id: contactId },
          include: {
            tags: { include: { tag: true } },
            leads: { include: { stage: true }, take: 1, orderBy: { updatedAt: "desc" } },
            deals: { include: { stage: true }, take: 1, orderBy: { updatedAt: "desc" } },
          },
        })
      : null;
    return {
      chatwootConversationId: conv.id,
      status: conv.status || "open",
      unreadCount: conv.unread_count || 0,
      lastMessagePreview: this.messagePreview(last),
      lastMessageAt: lastAt,
      assigneeName: conv.meta?.assignee?.available_name || conv.meta?.assignee?.name || null,
      labels: conv.labels || [],
      inbox: inbox
        ? { id: inbox.id, name: inbox.name, channelType: inbox.channelType }
        : conv.inbox_id
          ? { id: String(conv.inbox_id), name: "Inbox", channelType: "Channel::Api" }
          : null,
      contact: crm
        ? {
            id: crm.id,
            name: crm.name,
            email: crm.email,
            phone: crm.phone,
            createdAt: crm.createdAt,
            tags: crm.tags.map((t) => t.tag),
            stage: crm.leads[0]?.stage?.name || crm.deals[0]?.stage?.name || null,
          }
        : {
            id: "",
            name: sender?.name || "Contacto",
            email: sender?.email || null,
            phone: sender?.phone_number || null,
            createdAt: null,
            tags: [],
            stage: null,
          },
    };
  }

  async getConversations(organizationId: string, contactId: string) {
    const cached = await this.prisma.chatwootConversationLink.findMany({
      where: { organizationId, contactId },
      include: { inbox: true },
      orderBy: { lastMessageAt: "desc" },
    });
    try {
      const link = await this.prisma.chatwootContactLink.findUnique({
        where: { contactId },
      });
      if (!link) return cached;
      const { baseUrl, token, accountId } = await this.creds(organizationId);
      const res = await this.request<unknown>(
        baseUrl,
        token,
        `/api/v1/accounts/${accountId}/contacts/${link.chatwootContactId}/conversations`,
      );
      const payload = this.extractConversations(res);
      for (const conv of payload) {
        await this.hydrateConversation(organizationId, conv, contactId);
      }
      const refreshed = await this.prisma.chatwootConversationLink.findMany({
        where: { organizationId, contactId },
        include: { inbox: true },
        orderBy: { lastMessageAt: "desc" },
      });
      return { cached: refreshed, live: payload };
    } catch {
      return { cached, unavailable: true };
    }
  }

  async getMessages(
    organizationId: string,
    conversationId: number,
    before?: number,
  ) {
    const { baseUrl, token, accountId } = await this.creds(organizationId);
    const qs = before ? `?before=${before}` : "";
    const res = await this.request<unknown>(
      baseUrl,
      token,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages${qs}`,
    );
    let list: ChatwootMessage[] = [];
    if (Array.isArray(res)) {
      list = res as ChatwootMessage[];
    } else {
      const obj = res as { payload?: ChatwootMessage[] | { messages?: ChatwootMessage[] } };
      list = Array.isArray(obj.payload)
        ? obj.payload
        : (obj.payload as { messages?: ChatwootMessage[] })?.messages || [];
    }
    return list.slice(-50).map((message) => this.mapMessage(message, baseUrl));
  }

  async proxyAttachment(organizationId: string, rawUrl: string, res: Response) {
    const { baseUrl, token } = await this.creds(organizationId);
    const target = this.assertSafeAttachmentUrl(rawUrl, baseUrl);
    const upstream = await fetch(target, {
      headers: { api_access_token: token },
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    if (!upstream.ok || !upstream.body) {
      throw new BadGatewayException("Attachment unavailable");
    }
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const length = upstream.headers.get("content-length");
    const disposition = upstream.headers.get("content-disposition");
    res.status(200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=120");
    if (length) res.setHeader("Content-Length", length);
    if (disposition) res.setHeader("Content-Disposition", disposition);
    await pipeline(
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]),
      res,
    );
  }

  async setStatus(organizationId: string, conversationId: number, status: string) {
    const { baseUrl, token, accountId } = await this.creds(organizationId);
    const updated = await this.request(
      baseUrl,
      token,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`,
      { method: "POST", body: JSON.stringify({ status }) },
    );
    await this.prisma.chatwootConversationLink.updateMany({
      where: { organizationId, chatwootConversationId: conversationId },
      data: { status },
    });
    return updated;
  }

  async sendMessage(
    organizationId: string,
    conversationId: number,
    content: string,
    isPrivate = false,
    files?: UploadedMedia[],
  ) {
    const { baseUrl, token, accountId } = await this.creds(organizationId);
    const path = `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    if (!files?.length) {
      return this.request(baseUrl, token, path, {
        method: "POST",
        body: JSON.stringify({
          content,
          message_type: "outgoing",
          private: isPrivate,
        }),
      });
    }
    const form = new FormData();
    form.append("content", content?.trim() || "");
    form.append("message_type", "outgoing");
    form.append("private", isPrivate ? "true" : "false");
    for (const file of files) {
      const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || "application/octet-stream",
      });
      form.append("attachments[]", blob, file.originalname || "file");
    }
    return this.requestForm(baseUrl, token, path, form);
  }

  async assignConversation(
    organizationId: string,
    conversationId: number,
    assigneeId?: number,
  ) {
    const { baseUrl, token, accountId } = await this.creds(organizationId);
    return this.request(
      baseUrl,
      token,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ assignee_id: assigneeId }),
      },
    );
  }

  async updateConversation(
    organizationId: string,
    conversationId: number,
    data: Record<string, unknown>,
  ) {
    const { baseUrl, token, accountId } = await this.creds(organizationId);
    return this.request(
      baseUrl,
      token,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    );
  }

  openInChatwootUrl(organizationId: string, conversationId: number) {
    return this.prisma.chatwootConnection.findUnique({ where: { organizationId } }).then(
      (c) =>
        c
          ? `${c.baseUrl}/app/accounts/${c.accountId}/conversations/${conversationId}`
          : null,
    );
  }

  async handleWebhook(secret: string | undefined, payload: Record<string, unknown>) {
    const conn = await this.resolveConnection(payload, secret);
    if (!conn) return { ignored: true };
    const event = String(payload.event || "");
    const organizationId = conn.organizationId;

    if (event === "contact_created" || event === "contact_updated") {
      const contact = (payload as { id?: number }).id
        ? (payload as ChatwootContact)
        : ((payload.contact || payload) as ChatwootContact);
      if (contact?.id) {
        const contactId = await this.upsertContact(organizationId, contact);
        if (event === "contact_created") {
          await this.ensureLead(organizationId, contactId, "chatwoot");
          await this.automationQueue.add("trigger", {
            organizationId,
            trigger: "contact_created",
            contactId,
          });
        }
      }
    }

    if (
      event === "conversation_created" ||
      event === "conversation_updated" ||
      event === "conversation_status_changed"
    ) {
      await this.upsertConversationCache(organizationId, payload);
      await this.outbound.emit(organizationId, "conversation.created", {
        event,
        conversationId: this.conversationId(payload),
      });
      const trigger =
        event === "conversation_created"
          ? "new_conversation"
          : event === "conversation_status_changed" &&
              String((payload as { status?: string }).status) === "resolved"
            ? "conversation_resolved"
            : "conversation_assigned";
      await this.automationQueue.add("trigger", {
        organizationId,
        trigger,
        conversationId: this.conversationId(payload),
      });
    }

    if (event === "message_created") {
      await this.upsertConversationCache(organizationId, payload);
      const messageType = payload.message_type;
      const incoming = messageType === "incoming" || messageType === 0;
      if (incoming) {
        await this.outbound.emit(
          organizationId,
          "message.received",
          await this.incomingMessagePayload(organizationId, payload),
        );
        await this.automationQueue.add("trigger", {
          organizationId,
          trigger: "new_incoming_message",
          conversationId: this.conversationId(payload),
        });
        await this.aiQueue.add("reply", {
          organizationId,
          conversationId: this.conversationId(payload),
          chatwootContactId: this.contactIdFromPayload(payload),
        });
      }
      this.realtime.emitToOrg(organizationId, "conversation.updated", {
        conversationId: this.conversationId(payload),
      });
    }

    return { ok: true };
  }

  private conversationId(payload: Record<string, unknown>) {
    const conv = payload.conversation as { id?: number } | undefined;
    return Number(conv?.id || payload.id || 0);
  }

  private contactIdFromPayload(payload: Record<string, unknown>) {
    const sender = payload.sender as { id?: number } | undefined;
    const meta = (payload.conversation as { meta?: { sender?: { id?: number } } })?.meta;
    return Number(sender?.id || meta?.sender?.id || 0);
  }

  private webhookSender(payload: Record<string, unknown>): ChatwootContact | undefined {
    const conversation = payload.conversation as
      | { meta?: { sender?: ChatwootContact }; contact?: ChatwootContact }
      | undefined;
    return (
      (payload.sender as ChatwootContact | undefined) ||
      conversation?.meta?.sender ||
      conversation?.contact
    );
  }

  private async incomingMessagePayload(organizationId: string, payload: Record<string, unknown>) {
    const conversationId = this.conversationId(payload);
    const chatwootContactId = this.contactIdFromPayload(payload);
    const sender = this.webhookSender(payload);
    const content = String(payload.content || "");
    let contactId: string | null = null;
    let contactPublicNumber: number | null = null;
    let leadId: string | null = null;
    let leadPublicNumber: number | null = null;
    let stageSlug: string | null = null;
    let phone = sender?.phone_number || "";
    let name = sender?.name || "";
    let email = sender?.email || "";

    if (chatwootContactId) {
      const link = await this.prisma.chatwootContactLink.findUnique({
        where: {
          organizationId_chatwootContactId: { organizationId, chatwootContactId },
        },
        include: {
          contact: {
            include: {
              leads: { take: 1, orderBy: { updatedAt: "desc" }, include: { stage: true } },
            },
          },
        },
      });
      if (link?.contact) {
        contactId = link.contact.id;
        contactPublicNumber = link.contact.publicNumber;
        phone = link.contact.phone || phone;
        name = link.contact.name || name;
        email = link.contact.email || email;
        const lead = link.contact.leads[0];
        if (lead) {
          leadId = lead.id;
          leadPublicNumber = lead.publicNumber;
          stageSlug = lead.stage?.slug || null;
        }
      }
    }

    return {
      conversationId,
      chatwootContactId: chatwootContactId || null,
      contactId,
      contactPublicNumber,
      leadId,
      leadPublicNumber,
      stageSlug,
      phone,
      name,
      email,
      content,
      chatInput: content,
    };
  }

  private async resolveConnection(
    payload: Record<string, unknown>,
    secret?: string,
  ) {
    if (secret) {
      const bySecret = await this.prisma.chatwootConnection.findFirst({
        where: { webhookSecret: secret, connected: true },
      });
      if (bySecret) return bySecret;
    }
    const account = payload.account as { id?: number } | undefined;
    if (account?.id) {
      return this.prisma.chatwootConnection.findFirst({
        where: { accountId: String(account.id), connected: true },
      });
    }
    return this.prisma.chatwootConnection.findFirst({ where: { connected: true } });
  }

  private async upsertConversationCache(
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    const conversation = (payload.conversation || payload) as {
      id?: number;
      status?: string;
      inbox_id?: number;
      last_activity_at?: number;
      messages?: ChatwootMessage[];
      meta?: { sender?: ChatwootContact };
      contact?: ChatwootContact;
    };
    const cwConvId = Number(conversation.id);
    if (!cwConvId) return;
    const cwContact =
      conversation.meta?.sender ||
      conversation.contact ||
      (payload.sender as ChatwootContact);
    let contactId: string | undefined;
    if (cwContact?.id) {
      contactId = await this.upsertContact(organizationId, cwContact);
      await this.prisma.contact.update({
        where: { id: contactId },
        data: { lastInteractionAt: new Date() },
      });
    }
    if (!contactId) return;
    const inbox = conversation.inbox_id
      ? await this.prisma.chatwootInbox.findUnique({
          where: {
            organizationId_chatwootInboxId: {
              organizationId,
              chatwootInboxId: conversation.inbox_id,
            },
          },
        })
      : null;
    const last = conversation.messages?.at(-1) || (payload as ChatwootMessage);
    await this.prisma.chatwootConversationLink.upsert({
      where: {
        organizationId_chatwootConversationId: {
          organizationId,
          chatwootConversationId: cwConvId,
        },
      },
      create: {
        organizationId,
        contactId,
        inboxId: inbox?.id,
        chatwootConversationId: cwConvId,
        status: conversation.status || "open",
        lastMessagePreview: this.messagePreview(last),
        lastMessageAt: new Date(),
        messageCount: conversation.messages?.length || 1,
      },
      update: {
        status: conversation.status || undefined,
        lastMessagePreview: this.messagePreview(last),
        lastMessageAt: new Date(),
        inboxId: inbox?.id,
      },
    });
  }

  private async ensureLead(
    organizationId: string,
    contactId: string,
    source: string,
  ) {
    const { lead, created } = await this.leads.ensureForContact(organizationId, contactId, source);
    if (created) {
      await this.automationQueue.add("trigger", {
        organizationId,
        trigger: "lead_created",
        contactId,
        leadId: lead.id,
      });
    }
    return lead;
  }
}
