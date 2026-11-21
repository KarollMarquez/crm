"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CopyValue } from "@/components/copy-value";
import { Button, Card, PageHeader } from "@/components/ui";

type Contact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  lastInteractionAt?: string;
  tags: { tag: { id: string; name: string; color: string } }[];
  leads: { status: string; service?: string }[];
  conversations: { lastMessagePreview?: string; inbox?: { name: string } }[];
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  async function load(query = "") {
    const qs = query ? `?q=${encodeURIComponent(query)}` : "";
    setContacts(await api(`/contacts${qs}`));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api("/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        source: "manual",
      }),
    });
    setOpen(false);
    load(q);
  }

  return (
    <div>
      <PageHeader
        title="Contactos"
        subtitle="Fuente comercial. Las conversaciones viven en Chatwoot."
        actions={<Button onClick={() => setOpen(true)}>Nuevo contacto</Button>}
      />
      <input
        className="mb-4 max-w-sm"
        placeholder="Buscar nombre, email o teléfono"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          load(e.target.value);
        }}
      />
      {open ? (
        <Card className="mb-4 max-w-lg">
          <form onSubmit={create} className="grid gap-2">
            <input name="name" placeholder="Nombre" required />
            <input name="email" placeholder="Email" />
            <input name="phone" placeholder="Teléfono" />
            <div className="flex gap-2">
              <Button type="submit">Guardar</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Último mensaje</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/contacts/${c.id}`} className="font-medium text-indigo-700">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.phone ? (
                    <CopyValue value={c.phone} mono={false} />
                  ) : (
                    <span className="text-slate-400">Sin teléfono</span>
                  )}
                  {c.email ? <div className="mt-0.5 text-xs text-slate-400">{c.email}</div> : null}
                </td>
                <td className="px-4 py-3">
                  {c.tags.map((t) => (
                    <span key={t.tag.id} className="mr-1 text-xs" style={{ color: t.tag.color }}>
                      {t.tag.name}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3">{c.leads[0]?.status || "—"}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-500">
                  {c.conversations[0]?.lastMessagePreview || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
