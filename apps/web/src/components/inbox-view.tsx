"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import { Select } from "@/components/select";

type Tag = { id: string; name: string; color: string };
type InboxRow = {
  chatwootConversationId: number;
  status: string;
  unreadCount: number;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  assigneeName?: string | null;
  labels: string[];
  inbox?: { id: string; name: string; channelType: string } | null;
  contact: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    createdAt?: string | null;
    tags: Tag[];
    stage?: string | null;
  };
};
type Attachment = {
  id?: number;
  fileType?: string;
  filename?: string | null;
  fileSize?: number | null;
  dataUrl?: string | null;
  thumbUrl?: string | null;
};
type Message = {
  id: number;
  content?: string;
  message_type?: number | string;
  created_at?: number | string;
  private?: boolean;
  sender?: { name?: string; type?: string };
  attachments?: Attachment[];
};

const MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024;
const MAX_ATTACHMENTS = 8;
const COMPOSER_ACCEPT = "image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.mp4,.webm,.mov,.m4v,.mp3,.wav,.ogg,.m4a,.aac";
const DETAILS_OPEN_KEY = "crm.inbox.detailsOpen";
const LIST_OPEN_KEY = "crm.inbox.listOpen";

function readStoredOpen(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return fallback;
    return value !== "0";
  } catch {
    return fallback;
  }
}

function persistOpen(key: string, open: boolean) {
  try {
    window.localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function channelLabel(type?: string) {
  if (!type) return "Chat";
  if (type.toLowerCase().includes("whatsapp")) return "WhatsApp";
  if (type.toLowerCase().includes("email")) return "Email";
  if (type.toLowerCase().includes("twitter")) return "Twitter";
  if (type.toLowerCase().includes("instagram")) return "Instagram";
  if (type.toLowerCase().includes("facebook")) return "Facebook";
  if (type.toLowerCase().includes("web")) return "Web";
  return "Chat";
}

function relativeTime(value?: string | number | null) {
  if (!value) return "";
  const date =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

function clock(value?: string | number | null) {
  if (!value) return "";
  const date =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function isIncoming(m: Message) {
  return m.message_type === 0 || m.message_type === "incoming";
}
function isOutgoing(m: Message) {
  return m.message_type === 1 || m.message_type === "outgoing";
}
function isActivity(m: Message) {
  return m.message_type === 2 || m.message_type === "activity";
}

function formatSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentKind(att: Attachment): "image" | "audio" | "video" | "file" | "sticker" {
  const type = (att.fileType || "").toLowerCase();
  if (type === "image" || type === "audio" || type === "video" || type === "sticker") return type;
  if (type === "ig_reel") return "video";
  const mimeHint = type.includes("/") ? type : "";
  if (mimeHint.startsWith("image/")) return "image";
  if (mimeHint.startsWith("audio/")) return "audio";
  if (mimeHint.startsWith("video/")) return "video";
  const name = `${att.filename || ""} ${att.dataUrl || ""}`.toLowerCase();
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|$)/.test(name)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|opus)(\?|$)/.test(name)) return "audio";
  if (/\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(name)) return "image";
  return "file";
}

function AttachmentView({
  att,
  mine,
  onOpenImage,
}: {
  att: Attachment;
  mine: boolean;
  onOpenImage: (url: string) => void;
}) {
  const kind = attachmentKind(att);
  const src = att.dataUrl || att.thumbUrl || "";
  const linkClass = mine
    ? "text-indigo-100 underline decoration-indigo-200/80"
    : "text-indigo-600 underline decoration-indigo-200";

  if (kind === "sticker") {
    return <StickerView att={att} mine={mine} />;
  }
  if (kind === "image" && src) {
    return (
      <button type="button" onClick={() => onOpenImage(src)} className="block overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={att.filename || "Imagen"}
          className="max-h-64 max-w-[240px] rounded-xl object-cover"
        />
      </button>
    );
  }
  if (kind === "audio" && src) {
    return <audio src={src} controls preload="metadata" className="w-56 max-w-full" />;
  }
  if (kind === "video" && src) {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        className="max-h-64 w-full max-w-[280px] rounded-xl bg-black"
      />
    );
  }
  if (src) {
    return (
      <a href={src} download={att.filename || true} target="_blank" rel="noreferrer" className={`text-xs font-medium ${linkClass}`}>
        {att.filename || "Archivo"}
        {att.fileSize ? ` · ${formatSize(att.fileSize)}` : ""}
      </a>
    );
  }
  return (
    <span className={`text-xs ${mine ? "text-indigo-100" : "text-slate-500"}`}>
      {att.filename || "Archivo"}
    </span>
  );
}

function StickerView({ att, mine }: { att: Attachment; mine: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = att.thumbUrl || att.dataUrl;
  if (!src || failed) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
          mine ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        Sticker
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Sticker"
      className="h-24 w-24 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function InboxView({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const selectedId = Number(search.get("c") || initialId || 0) || null;
  const [connected, setConnected] = useState<boolean | null>(null);
  const [inboxes, setInboxes] = useState<{ id: string; name: string }[]>([]);
  const [inboxId, setInboxId] = useState("");
  const [filter, setFilter] = useState<"all" | "unassigned" | "mine">("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [previous, setPrevious] = useState<
    { chatwootConversationId: number; status: string; lastMessagePreview?: string | null }[]
  >([]);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedIdRef = useRef<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [inboxPrefsReady, setInboxPrefsReady] = useState(false);

  const selected = rows.find((r) => r.chatwootConversationId === selectedId) || null;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    setDetailsOpen(readStoredOpen(DETAILS_OPEN_KEY, true));
    setListOpen(readStoredOpen(LIST_OPEN_KEY, true));
    setInboxPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!inboxPrefsReady) return;
    persistOpen(DETAILS_OPEN_KEY, detailsOpen);
    persistOpen(LIST_OPEN_KEY, listOpen);
  }, [detailsOpen, inboxPrefsReady, listOpen]);

  async function loadList() {
    try {
      const status = await api<{ connected: boolean; inboxes: { id: string; name: string }[] }>(
        "/chatwoot/status",
      );
      setConnected(status.connected);
      setInboxes(status.inboxes || []);
      if (!status.connected) {
        setRows([]);
        setLoading(false);
        return;
      }
      const params = new URLSearchParams();
      if (inboxId) params.set("inboxId", inboxId);
      if (q) params.set("q", q);
      if (filter === "mine") params.set("assignee", "mine");
      if (filter === "unassigned") params.set("assignee", "unassigned");
      const data = await api<{ conversations: InboxRow[]; unavailable?: boolean }>(
        `/inbox?${params.toString()}`,
      );
      setRows(data.conversations || []);
      setUnavailable(!!data.unavailable);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const delay = q ? 300 : 0;
    const t = setTimeout(() => loadList(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxId, filter, q]);

  async function loadThread(id: number, contactId?: string) {
    try {
      const msgs = await api<Message[]>(`/chatwoot/conversations/${id}/messages`);
      if (selectedIdRef.current !== id) return;
      setMessages(Array.isArray(msgs) ? msgs : []);
      setUnavailable(false);
    } catch {
      if (selectedIdRef.current !== id) return;
      setUnavailable(true);
      setMessages([]);
    }
    if (!contactId) return;
    try {
      const extra = await api<{
        cached?: {
          chatwootConversationId: number;
          status: string;
          lastMessagePreview?: string | null;
        }[];
      }>(`/chatwoot/contacts/${contactId}/conversations`);
      const list = extra.cached || [];
      setPrevious(list.filter((c) => c.chatwootConversationId !== id));
    } catch {
      setPrevious([]);
    }
  }

  function selectConversation(id: number, contactId?: string) {
    if (search.get("c") !== String(id)) {
      router.replace(`/inbox?c=${id}`, { scroll: false });
    }
    loadThread(id, contactId);
  }

  useEffect(() => {
    if (!selectedId) return;
    const contactId = rows.find((r) => r.chatwootConversationId === selectedId)?.contact.id;
    loadThread(selectedId, contactId);
    setPendingFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, selectedId]);

  async function sendMessage() {
    if (!selectedId) return;
    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;
    setSending(true);
    try {
      if (pendingFiles.length) {
        const fd = new FormData();
        if (text) fd.append("content", text);
        for (const file of pendingFiles) fd.append("attachments", file);
        await api(`/chatwoot/conversations/${selectedId}/messages`, {
          method: "POST",
          body: fd,
        });
        setPendingFiles([]);
      } else {
        await api(`/chatwoot/conversations/${selectedId}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: text }),
        });
      }
      setDraft("");
      await loadThread(selectedId, selected?.contact.id);
      loadList();
    } finally {
      setSending(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...pendingFiles];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) break;
      if (file.size > MAX_ATTACHMENT_BYTES) continue;
      next.push(file);
    }
    setPendingFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function setStatus(status: string) {
    if (!selectedId) return;
    await api(`/chatwoot/conversations/${selectedId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    loadList();
  }

  const counts = useMemo(() => ({ all: rows.length }), [rows]);

  if (connected === false) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">Inbox</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Conecta Chatwoot para ver y responder conversaciones aquí, sin salir del CRM.
          </p>
          <Link href="/integrations" className="mt-4 inline-flex text-sm font-medium text-indigo-600">
            Ir a Integraciones
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white">
      {listOpen ? (
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Inbox</h1>
            <div className="flex items-center gap-1">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{counts.all}</span>
              <button
                type="button"
                aria-label="Ocultar conversaciones"
                title="Ocultar conversaciones"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
                onClick={() => setListOpen(false)}
              >
                <PanelLeftIcon />
              </button>
            </div>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversaciones"
          />
          <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-medium">
            {(
              [
                ["all", "Todas"],
                ["unassigned", "Sin asignar"],
                ["mine", "Mías"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`flex-1 rounded-lg px-2 py-1.5 ${
                  filter === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {inboxes.length > 0 ? (
            <div className="mt-3">
              <Select
                value={inboxId}
                placeholder="Todos los canales"
                options={[
                  { value: "", label: "Todos los canales" },
                  ...inboxes.map((i) => ({ value: i.id, label: i.name })),
                ]}
                onChange={setInboxId}
              />
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? <p className="p-4 text-sm text-slate-400">Cargando…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No hay conversaciones todavía.</p>
          ) : null}
          {rows.map((row) => {
            const active = row.chatwootConversationId === selectedId;
            return (
              <button
                key={row.chatwootConversationId}
                type="button"
                onClick={() => selectConversation(row.chatwootConversationId, row.contact.id)}
                className={`flex w-full gap-3 border-l-4 px-4 py-3 text-left ${
                  active ? "border-indigo-600 bg-indigo-50/60" : "border-transparent hover:bg-slate-50"
                }`}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {initials(row.contact.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{row.contact.name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(row.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{row.lastMessagePreview || "Sin mensajes"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {channelLabel(row.inbox?.channelType)}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] capitalize text-slate-500">
                      {row.status}
                    </span>
                    {row.assigneeName ? (
                      <span className="truncate text-[10px] text-slate-400">{row.assigneeName}</span>
                    ) : (
                      <span className="text-[10px] text-amber-600">Sin asignar</span>
                    )}
                    {row.unreadCount > 0 ? (
                      <span className="ml-auto rounded-full bg-indigo-600 px-1.5 text-[10px] text-white">
                        {row.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
      ) : (
        <div className="flex w-11 shrink-0 flex-col items-center border-r border-slate-200 bg-white py-3">
          <button
            type="button"
            aria-label="Mostrar conversaciones"
            title="Mostrar conversaciones"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-50"
            onClick={() => setListOpen(true)}
          >
            <PanelLeftIcon />
          </button>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {initials(selected.contact.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{selected.contact.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {selected.contact.email || selected.contact.phone || selected.inbox?.name}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {unavailable ? (
                  <span className="text-xs text-amber-600">Chatwoot temporalmente no disponible</span>
                ) : null}
                <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((open) => !open)} />
              </div>
            </header>
            <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-6 py-4">
              {messages.map((m) => {
                if (isActivity(m)) {
                  return (
                    <div key={m.id} className="flex justify-center">
                      <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs text-amber-800">
                        {m.content}
                      </span>
                    </div>
                  );
                }
                const mine = isOutgoing(m);
                const attachments = m.attachments || [];
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "rounded-br-md bg-indigo-600 text-white"
                          : "rounded-bl-md bg-white text-slate-800 shadow-sm"
                      }`}
                    >
                      {attachments.length ? (
                        <div className={m.content ? "mb-2 space-y-2" : "space-y-2"}>
                          {attachments.map((att, i) => (
                            <AttachmentView
                              key={att.id ?? `${m.id}-${i}`}
                              att={att}
                              mine={mine}
                              onOpenImage={setLightbox}
                            />
                          ))}
                        </div>
                      ) : null}
                      {m.content ? <p className="whitespace-pre-wrap">{m.content}</p> : null}
                      <div className={`mt-1 text-[10px] ${mine ? "text-indigo-100" : "text-slate-400"}`}>
                        {clock(m.created_at)} {m.sender?.name ? `· ${m.sender.name}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="border-t border-slate-100 bg-white p-4"
            >
              {pendingFiles.length ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {pendingFiles.map((file, i) => (
                    <span
                      key={`${file.name}-${i}`}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-700"
                        onClick={() => setPendingFiles((files) => files.filter((_, idx) => idx !== i))}
                        aria-label="Quitar archivo"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={COMPOSER_ACCEPT}
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={sending}
                  aria-label="Adjuntar archivo"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.44 11.05l-8.49 8.49a5.25 5.25 0 01-7.42-7.42l8.48-8.49a3.5 3.5 0 014.95 4.95l-8.48 8.49a1.75 1.75 0 01-2.48-2.48l7.78-7.78"
                    />
                  </svg>
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escribe un mensaje…"
                  rows={2}
                  className="flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button type="submit" disabled={sending || (!draft.trim() && pendingFiles.length === 0)}>
                  Enviar
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex items-center justify-end border-b border-slate-100 px-5 py-3">
              <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((open) => !open)} />
            </header>
            <div className="grid flex-1 place-items-center text-sm text-slate-400">
              Elige una conversación para responder aquí.
            </div>
          </div>
        )}
      </section>

      {detailsOpen ? (
      <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
        {selected ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <h2 className="text-sm font-semibold text-slate-500">Datos del cliente</h2>
            <div className="mt-4 flex flex-col items-center text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700">
                {initials(selected.contact.name)}
              </div>
              <div className="mt-2 font-semibold">{selected.contact.name}</div>
              {selected.contact.email ? <div className="text-sm text-slate-500">{selected.contact.email}</div> : null}
              {selected.contact.phone ? <div className="text-sm text-slate-500">{selected.contact.phone}</div> : null}
              {selected.contact.id ? (
                <Link href={`/contacts/${selected.contact.id}`} className="mt-2 text-xs font-medium text-indigo-600">
                  Abrir ficha en el CRM
                </Link>
              ) : null}
            </div>

            <div className="mt-6">
              <div className="text-xs font-medium text-slate-500">Agente</div>
              <p className="mt-1 text-sm">{selected.assigneeName || "Sin asignar"}</p>
            </div>

            <div className="mt-4">
              <div className="mb-1 text-xs font-medium text-slate-500">Estado</div>
              <Select
                value={selected.status}
                options={[
                  { value: "open", label: "Abierta" },
                  { value: "pending", label: "Pendiente" },
                  { value: "resolved", label: "Resuelta" },
                ]}
                onChange={setStatus}
              />
            </div>

            {selected.contact.stage ? (
              <div className="mt-4">
                <div className="text-xs font-medium text-slate-500">Pipeline</div>
                <p className="mt-1 text-sm">{selected.contact.stage}</p>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-xs font-medium text-slate-500">Etiquetas</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.contact.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{ background: `${t.color}22`, color: t.color }}
                  >
                    {t.name}
                  </span>
                ))}
                {(selected.labels || []).map((l) => (
                  <span key={l} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {l}
                  </span>
                ))}
                {selected.contact.tags.length === 0 && (selected.labels || []).length === 0 ? (
                  <span className="text-xs text-slate-400">Sin etiquetas</span>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs font-medium text-slate-500">Conversaciones anteriores</div>
              <div className="mt-2 space-y-2">
                {previous.length === 0 ? (
                  <p className="text-xs text-slate-400">No hay otras conversaciones.</p>
                ) : null}
                {previous.slice(0, 6).map((p) => (
                  <button
                    key={p.chatwootConversationId}
                    type="button"
                    className="block w-full rounded-lg bg-slate-50 px-2 py-2 text-left text-xs"
                    onClick={() => selectConversation(p.chatwootConversationId, selected.contact.id)}
                  >
                    <div className="font-medium capitalize">{p.status}</div>
                    <div className="truncate text-slate-500">{p.lastMessagePreview}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center text-sm text-slate-400">
            Los datos del contacto aparecen al abrir un chat.
          </div>
        )}
      </aside>
      ) : null}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

function DetailsToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={open ? "Ocultar datos del cliente" : "Mostrar datos del cliente"}
      title={open ? "Ocultar datos del cliente" : "Mostrar datos del cliente"}
      className={`grid h-9 w-9 place-items-center rounded-lg ${
        open ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
      }`}
      onClick={onToggle}
    >
      <PanelRightIcon />
    </button>
  );
}

function PanelLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15" />
    </svg>
  );
}

function PanelRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M14.5 4.5v15" />
    </svg>
  );
}
