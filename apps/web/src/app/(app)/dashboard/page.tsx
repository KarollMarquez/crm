"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";

type Summary = {
  leads: Record<string, number>;
  pipeline: { totalValue: number; wonValue: number; lostValue: number; conversion: number; open: number };
  tasks: Record<string, number>;
  whatsapp: { conversations: number; lastActivity: string | null };
  campaigns: { id: string; name: string; status: string; sent: number; replies: number }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  useEffect(() => {
    api<Summary>("/dashboard").then(setData);
  }, []);

  if (!data) return <p>Cargando…</p>;

  const cards = [
    { label: "Leads nuevos", value: data.leads.new || 0 },
    { label: "Contactados", value: data.leads.contacted || 0 },
    { label: "Convertidos", value: data.leads.converted || 0 },
    { label: "Perdidos", value: data.leads.lost || 0 },
    { label: "Pipeline", value: `$${data.pipeline.totalValue}` },
    { label: "Ganado", value: `$${data.pipeline.wonValue}` },
    { label: "Conversión", value: `${data.pipeline.conversion}%` },
    { label: "Conversaciones", value: data.whatsapp.conversations },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Métricas comerciales y WhatsApp" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="mt-2 text-2xl font-semibold">{c.value}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <h2 className="mb-3 font-medium">Campañas</h2>
        <div className="space-y-2 text-sm">
          {data.campaigns.length === 0 ? <p className="text-slate-500">Sin campañas aún.</p> : null}
          {data.campaigns.map((c) => (
            <div key={c.id} className="flex justify-between">
              <span>{c.name}</span>
              <span className="text-slate-500">
                {c.status} · {c.sent} enviados · {c.replies} respuestas
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
