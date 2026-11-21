"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Select } from "@/components/select";
import { Button, Card, PageHeader } from "@/components/ui";

type Campaign = {
  id: string;
  name: string;
  status: string;
  sentCount: number;
  repliedCount: number;
  message: string;
};
type Segment = { id: string; name: string };
type Inbox = { id: string; name: string };

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);

  async function load() {
    setCampaigns(await api("/campaigns"));
    setSegments(await api("/segments"));
    const st = await api<{ inboxes: Inbox[] }>("/chatwoot/status");
    setInboxes(st.inboxes || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function createSegment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api("/segments", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        filters: { lastInteractionDays: Number(form.get("days") || 90) },
      }),
    });
    load();
  }

  async function createCampaign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        segmentId: form.get("segmentId") || undefined,
        inboxId: form.get("inboxId") || undefined,
        message: form.get("message"),
        templateName: form.get("templateName") || undefined,
      }),
    });
    load();
  }

  return (
    <div>
      <PageHeader title="Campañas" subtitle="Audiencias y envío de templates vía Chatwoot" />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-medium">Nuevo segmento</h2>
          <form onSubmit={createSegment} className="space-y-2">
            <input name="name" placeholder="Clientes antiguos" required />
            <input name="days" type="number" defaultValue={90} />
            <Button type="submit">Crear segmento</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-2 font-medium">Nueva campaña</h2>
          <form onSubmit={createCampaign} className="space-y-2">
            <input name="name" placeholder="Nombre" required />
            <Select
              name="segmentId"
              placeholder="Todos los segmentos"
              options={[{ value: "", label: "Todos los segmentos" }, ...segments.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <Select
              name="inboxId"
              placeholder="Inbox"
              options={[{ value: "", label: "Todos los inboxes" }, ...inboxes.map((i) => ({ value: i.id, label: i.name }))]}
            />
            <input name="templateName" placeholder="Template WhatsApp (oficial)" />
            <textarea name="message" placeholder="Mensaje / cuerpo de template" required />
            <Button type="submit">Crear</Button>
          </form>
        </Card>
      </div>
      <div className="space-y-2">
        {campaigns.map((c) => (
          <Card key={c.id} className="flex items-center justify-between">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-slate-500">
                {c.status} · {c.sentCount} enviados · {c.repliedCount} respuestas
              </div>
            </div>
            {c.status === "draft" ? (
              <Button onClick={() => api(`/campaigns/${c.id}/launch`, { method: "POST" }).then(load)}>
                Lanzar
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
