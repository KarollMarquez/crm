"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, PageHeader } from "@/components/ui";

type Status = {
  connected: boolean;
  accountName?: string;
  lastError?: string | null;
  inboxes?: { id: string; name: string; channelType: string }[];
};

type OutboundHook = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  secret?: string;
};

const WEBHOOK_EVENTS = [
  { value: "message.received", label: "message.received (WhatsApp / Chatwoot)" },
  { value: "lead.stage_changed", label: "lead.stage_changed" },
  { value: "contact.created", label: "contact.created" },
  { value: "conversation.created", label: "conversation.created" },
];

export default function IntegrationsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [hooks, setHooks] = useState<OutboundHook[] | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>(["message.received"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [hookError, setHookError] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    setStatus(await api("/chatwoot/status"));
    setHooks(await api<OutboundHook[]>("/settings/webhooks"));
  }
  useEffect(() => {
    load();
  }, []);

  async function connect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api("/chatwoot/connect", {
        method: "POST",
        body: JSON.stringify({
          baseUrl: form.get("baseUrl"),
          accountId: form.get("accountId"),
          apiAccessToken: form.get("apiAccessToken"),
        }),
      });
      setError("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar");
    }
  }

  async function createHook(e: FormEvent) {
    e.preventDefault();
    setHookError("");
    try {
      const created = await api<OutboundHook>("/settings/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: hookUrl, events: hookEvents }),
      });
      setNewSecret(created.secret || null);
      setHookUrl("");
      setHookEvents(["message.received"]);
      load();
    } catch (err) {
      setHookError(err instanceof Error ? err.message : "No se pudo crear el webhook");
    }
  }

  async function copySecret(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Integraciones" subtitle="Chatwoot y webhooks hacia n8n" />
      <Card className="max-w-xl">
        <h2 className="mb-3 font-medium">Chatwoot</h2>
        {status?.connected ? (
          <div className="space-y-2 text-sm">
            <p className="text-emerald-600">Conectado</p>
            <p>Account: {status.accountName}</p>
            <div>
              Inboxes:
              <ul className="mt-1 list-disc pl-5">
                {status.inboxes?.map((i) => (
                  <li key={i.id}>
                    {i.name} <span className="text-slate-400">{i.channelType}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => api("/chatwoot/sync", { method: "POST" }).then(load)}>
                Sincronizar contactos
              </Button>
              <Button variant="danger" onClick={() => api("/chatwoot/disconnect", { method: "DELETE" }).then(load)}>
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={connect} className="space-y-2">
            <input name="baseUrl" placeholder="https://chatwoot.midominio.com" required />
            <input name="accountId" placeholder="Account ID" required />
            <input name="apiAccessToken" type="password" placeholder="API Access Token" required />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button type="submit">Conectar</Button>
          </form>
        )}
      </Card>

      <Card className="max-w-xl">
        <h2 className="mb-1 font-medium">Webhook hacia n8n</h2>
        <p className="mb-3 text-sm text-slate-500">
          Pega la URL del Webhook del workflow Vista Mar. El CRM envía{" "}
          <code className="rounded bg-slate-100 px-1">message.received</code> con el texto y los IDs
          del lead.
        </p>

        {newSecret ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="mb-1 font-medium text-amber-900">
              Copia este secreto ahora. Firma el body con HMAC-SHA256 en la cabecera{" "}
              <code>X-CRM-Signature</code>.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-white px-2 py-1">{newSecret}</code>
              <Button type="button" variant="ghost" onClick={() => copySecret(newSecret)}>
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={createHook} className="mb-4 space-y-3">
          <input
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
            placeholder="https://n8n.midominio.com/webhook/vistamar-whatsapp"
            required
          />
          <div className="grid gap-2">
            {WEBHOOK_EVENTS.map((event) => (
              <label key={event.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={hookEvents.includes(event.value)}
                  onChange={() =>
                    setHookEvents((current) =>
                      current.includes(event.value)
                        ? current.filter((value) => value !== event.value)
                        : [...current, event.value],
                    )
                  }
                />
                {event.label}
              </label>
            ))}
          </div>
          {hookError ? <p className="text-sm text-rose-600">{hookError}</p> : null}
          <Button type="submit" disabled={!hookEvents.length}>
            Registrar webhook
          </Button>
        </form>

        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {!hooks ? (
            <p className="p-3 text-sm text-slate-500">Cargando…</p>
          ) : hooks.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">Aún no hay webhooks.</p>
          ) : (
            hooks.map((hook) => (
              <div key={hook.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="break-all font-medium">{hook.url}</p>
                  <p className="text-xs text-slate-500">
                    {hook.events.join(", ") || "sin eventos"}
                    {hook.active ? "" : " · inactivo"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => api(`/settings/webhooks/${hook.id}`, { method: "DELETE" }).then(load)}
                >
                  Quitar
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
