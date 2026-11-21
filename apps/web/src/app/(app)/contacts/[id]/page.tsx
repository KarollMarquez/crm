"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { CopyValue } from "@/components/copy-value";
import { Button, Card, PageHeader } from "@/components/ui";

type CustomField = { id: string; key: string; value: string };

type Lead = {
  id: string;
  publicNumber?: number | string;
  status: string;
  service?: string | null;
  value?: string | number;
  source?: string | null;
  ownerId?: string | null;
  owner?: { id: string; name: string } | null;
  stage?: { id: string; name: string; slug: string; color: string; publicNumber?: number | string } | null;
  updatedAt?: string;
  customFields?: CustomField[];
};

type Contact = {
  id: string;
  publicNumber?: number | string;
  name: string;
  email?: string;
  phone?: string;
  tags: { tag: { id: string; name: string; color: string } }[];
  customFields: CustomField[];
  leads: Lead[];
  notes: { id: string; body: string; createdAt: string }[];
  conversations: {
    chatwootConversationId: number;
    status: string;
    inbox?: { name: string; channelType: string };
  }[];
  chatwootLink?: { chatwootContactId: number } | null;
  appointments?: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    title?: string | null;
    notes?: string | null;
  }[];
};

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [deleting, setDeleting] = useState<"contact" | "lead" | null>(null);

  async function load() {
    const data = await api<Contact>(`/contacts/${id}`);
    setContact(data);
    if (data.conversations.length === 0 && data.id) {
      try {
        await api(`/chatwoot/contacts/${data.id}/conversations`);
        setContact(await api(`/contacts/${id}`));
      } catch {
        // Chatwoot may be down; keep cached contact.
      }
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api(`/contacts/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ body: form.get("body") }),
    });
    load();
  }

  async function deleteContact() {
    if (!contact) return;
    if (
      !confirm(
        `¿Eliminar a ${contact.name}? Se borrarán también sus leads y deals. No se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeleting("contact");
    try {
      await api(`/contacts/${id}`, { method: "DELETE" });
      router.push("/contacts");
    } finally {
      setDeleting(null);
    }
  }

  async function deleteLead() {
    const currentLead = contact?.leads[0];
    if (!currentLead) return;
    if (
      !confirm(
        "¿Eliminar este lead? El contacto se mantiene. Los deals del lead se borran.",
      )
    ) {
      return;
    }
    setDeleting("lead");
    try {
      await api(`/leads/${currentLead.id}`, { method: "DELETE" });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  if (!contact) return <p>Cargando…</p>;
  const lead = contact.leads[0];

  return (
    <div>
      <PageHeader
        title={contact.name}
        subtitle={`${contact.phone || ""} ${contact.email || ""}`}
        actions={
          <Button
            type="button"
            variant="danger"
            disabled={deleting === "contact"}
            onClick={deleteContact}
          >
            {deleting === "contact" ? "Eliminando…" : "Eliminar contacto"}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {contact.tags.map((t) => (
          <span key={t.tag.id} className="rounded-full px-2 py-0.5 text-xs" style={{ color: t.tag.color }}>
            {t.tag.name}
          </span>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="font-medium">Datos del contacto</h2>
            {contact.publicNumber != null ? <CopyValue asId value={contact.publicNumber} /> : null}
          </div>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              await api(`/contacts/${id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  name: form.get("name"),
                  phone: form.get("phone"),
                  email: form.get("email"),
                }),
              });
              load();
            }}
          >
            <input name="name" defaultValue={contact.name} placeholder="Nombre" />
            <input name="phone" defaultValue={contact.phone || ""} placeholder="Teléfono" />
            <input name="email" defaultValue={contact.email || ""} placeholder="Email" />
            <Button type="submit">Guardar</Button>
          </form>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-sm font-medium">Campos extra del contacto</h3>
            <div className="space-y-2">
              {contact.customFields.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-500">{f.key}</span>
                  <span className="flex-1">{f.value}</span>
                  <button
                    type="button"
                    className="text-xs text-rose-600"
                    onClick={() => api(`/contacts/${id}/fields/${f.id}`, { method: "DELETE" }).then(load)}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
            <form
              className="mt-3 grid grid-cols-2 gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                await api(`/contacts/${id}/fields`, {
                  method: "POST",
                  body: JSON.stringify({ key: form.get("key"), value: form.get("value") }),
                });
                e.currentTarget.reset();
                load();
              }}
            >
              <input name="key" placeholder="Campo" required />
              <input name="value" placeholder="Valor" required />
              <Button type="submit" className="col-span-2">
                Añadir campo
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="font-medium">Datos del lead</h2>
            {lead?.publicNumber != null ? <CopyValue asId value={lead.publicNumber} /> : null}
          </div>
          {lead ? (
            <>
              <form
                key={`${lead.id}-${lead.updatedAt || lead.status}`}
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  setSavingLead(true);
                  try {
                    await api(`/leads/${lead.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        service: form.get("service") || null,
                        value: Number(form.get("value") || 0),
                        source: form.get("source") || null,
                      }),
                    });
                    await load();
                  } finally {
                    setSavingLead(false);
                  }
                }}
              >
                {lead.stage ? (
                  <p className="text-sm" style={{ color: lead.stage.color }}>
                    Etapa: {lead.stage.name}
                  </p>
                ) : null}
                <label className="block text-xs font-medium text-slate-500">Servicio</label>
                <input name="service" defaultValue={lead.service || ""} placeholder="Servicio" />
                <label className="block text-xs font-medium text-slate-500">Valor</label>
                <input
                  name="value"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={lead.value != null ? String(lead.value) : "0"}
                  placeholder="Valor"
                />
                <label className="block text-xs font-medium text-slate-500">Fuente</label>
                <input name="source" defaultValue={lead.source || ""} placeholder="Fuente" />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={savingLead}>
                    {savingLead ? "Guardando…" : "Guardar lead"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={deleting === "lead"}
                    onClick={deleteLead}
                  >
                    {deleting === "lead" ? "Eliminando…" : "Eliminar lead"}
                  </Button>
                </div>
              </form>
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-medium">Campos extra del lead</h3>
                <div className="space-y-2">
                  {(lead.customFields || []).map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500">{f.key}</span>
                      <span className="flex-1">{f.value}</span>
                      <button
                        type="button"
                        className="text-xs text-rose-600"
                        onClick={() => api(`/leads/${lead.id}/fields/${f.id}`, { method: "DELETE" }).then(load)}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  className="mt-3 grid grid-cols-2 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    await api(`/leads/${lead.id}/fields`, {
                      method: "POST",
                      body: JSON.stringify({ key: form.get("key"), value: form.get("value") }),
                    });
                    e.currentTarget.reset();
                    load();
                  }}
                >
                  <input name="key" placeholder="Campo" required />
                  <input name="value" placeholder="Valor" required />
                  <Button type="submit" className="col-span-2">
                    Añadir campo
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <Button
              onClick={async () => {
                await api("/leads", {
                  method: "POST",
                  body: JSON.stringify({ contactId: id, source: "manual" }),
                });
                load();
              }}
            >
              Crear lead
            </Button>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Citas</h2>
            <Link href="/agenda" className="text-sm text-indigo-600">
              Ver agenda
            </Link>
          </div>
          {(contact.appointments || []).length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay citas para este contacto.</p>
          ) : (
            <div className="space-y-2">
              {(contact.appointments || []).slice(0, 8).map((appointment) => (
                <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">
                      {new Date(appointment.startsAt).toLocaleString("es", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-slate-500">{appointment.title || "Cita"}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                    {appointment.status === "scheduled"
                      ? "Agendada"
                      : appointment.status === "cancelled"
                        ? "Cancelada"
                        : appointment.status === "completed"
                          ? "Completada"
                          : appointment.status === "no_show"
                            ? "No asistió"
                            : appointment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-medium">Conversaciones</h2>
          {contact.conversations.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no hay conversaciones. Las conversaciones se ven solo en Inbox.
            </p>
          ) : null}
          {contact.conversations.map((c) => (
            <div key={c.chatwootConversationId} className="mb-2 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{c.inbox?.name || "Inbox"}</div>
                <div className="capitalize text-slate-500">{c.status}</div>
              </div>
              <Link href={`/inbox?c=${c.chatwootConversationId}`}>
                <Button type="button">Abrir en Inbox</Button>
              </Link>
            </div>
          ))}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-2 font-medium">Notas</h2>
          <form onSubmit={addNote} className="mb-3 flex gap-2">
            <input name="body" placeholder="Agregar nota" />
            <Button type="submit">Guardar</Button>
          </form>
          {contact.notes.map((n) => (
            <p key={n.id} className="text-sm text-slate-600">
              {n.body}
            </p>
          ))}
        </Card>
      </div>
    </div>
  );
}
