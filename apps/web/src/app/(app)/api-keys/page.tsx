"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, PageHeader } from "@/components/ui";

const API_SCOPES = [
  { value: "contacts.read", label: "Ver contactos", group: "Contactos" },
  { value: "contacts.write", label: "Crear y editar contactos", group: "Contactos" },
  { value: "leads.read", label: "Ver leads", group: "Leads" },
  { value: "leads.write", label: "Mover y editar leads", group: "Leads" },
  { value: "tags.read", label: "Ver etiquetas", group: "Etiquetas" },
  { value: "tags.write", label: "Crear y asignar etiquetas", group: "Etiquetas" },
  { value: "tasks.read", label: "Ver tareas", group: "Tareas" },
  { value: "tasks.write", label: "Crear y editar tareas", group: "Tareas" },
  { value: "appointments.read", label: "Ver citas", group: "Citas" },
  { value: "appointments.write", label: "Crear y editar citas", group: "Citas" },
];

const PERMISSION_GROUPS = [...new Set(API_SCOPES.map((scope) => scope.group))];

const DEFAULT_KEY_SCOPES = API_SCOPES.map((scope) => scope.value);

const SCOPE_GROUPS = [
  { prefix: "contacts", label: "Contactos" },
  { prefix: "leads", label: "Leads" },
  { prefix: "tags", label: "Etiquetas" },
  { prefix: "tasks", label: "Tareas" },
  { prefix: "appointments", label: "Citas" },
];

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function shortPermissions(scopes: string[]) {
  const labels = SCOPE_GROUPS.filter((group) => scopes.some((scope) => scope.startsWith(`${group.prefix}.`))).map(
    (group) => {
      const canRead = scopes.includes(`${group.prefix}.read`);
      const canWrite = scopes.includes(`${group.prefix}.write`);
      if (canRead && canWrite) return group.label;
      if (canWrite) return `${group.label} (editar)`;
      if (canRead) return `${group.label} (ver)`;
      return group.label;
    },
  );
  return labels.length ? labels.join(", ") : "—";
}

function formatLastUsed(value: string | null) {
  if (!value) return "Sin usar";
  return new Date(value).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(DEFAULT_KEY_SCOPES);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setKeys(await api<ApiKeyRow[]>("/settings/api-keys"));
  }
  useEffect(() => {
    load();
  }, []);

  async function createKey(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const created = await api<ApiKeyRow & { secret: string }>("/settings/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: keyName.trim(), scopes: keyScopes }),
      });
      setNewSecret(created.secret);
      setKeyName("");
      setKeyScopes(DEFAULT_KEY_SCOPES);
      setCreating(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la clave.");
    }
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  }

  async function revoke(id: string) {
    await api(`/settings/api-keys/${id}/revoke`, { method: "POST" });
    load();
  }

  if (!keys) return <p>Cargando…</p>;

  const countLabel =
    keys.length === 0 ? "Aún no tienes claves" : keys.length === 1 ? "Tienes 1 clave" : `Tienes ${keys.length} claves`;

  return (
    <div>
      <PageHeader
        title="API Keys"
        subtitle={countLabel}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/api-docs"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Documentación
            </Link>
            <Button
              type="button"
              onClick={() => {
                setError("");
                setCreating(true);
              }}
            >
              Crear clave
            </Button>
          </div>
        }
      />

      {newSecret ? (
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-medium text-slate-900">Copia esta clave ahora</p>
            <p className="mt-1 text-sm text-slate-500">
              Se muestra una sola vez. Si la pierdes, crea otra y revoca esta.
            </p>
          </div>
          <div className="bg-slate-900 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 break-all font-mono text-sm text-slate-100">{newSecret}</code>
              <button
                type="button"
                onClick={() => copy(newSecret, "secret")}
                className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                {copied === "secret" ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
          <p className="px-5 py-3 text-xs text-amber-800">
            No la compartas. Nadie del equipo te pedirá esta clave.
          </p>
        </div>
      ) : null}

      {creating ? (
        <div
          className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-900/40 p-4"
          onClick={() => {
            setError("");
            setCreating(false);
          }}
        >
          <div
            className="w-full max-w-2xl overflow-visible rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={createKey} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Sitio web, WhatsApp, integración…"
                  required
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Permisos</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group} className="rounded-xl border border-slate-200 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{group}</p>
                      <div className="space-y-2">
                        {API_SCOPES.filter((scope) => scope.group === group).map((scope) => (
                          <label key={scope.value} className="flex items-start gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={keyScopes.includes(scope.value)}
                              onChange={() =>
                                setKeyScopes((current) =>
                                  current.includes(scope.value)
                                    ? current.filter((item) => item !== scope.value)
                                    : [...current, scope.value],
                                )
                              }
                            />
                            {scope.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={!keyScopes.length || !keyName.trim()}>
                  Crear clave
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setError("");
                    setCreating(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Clave</th>
              <th className="px-4 py-3">Permisos</th>
              <th className="px-4 py-3">Último uso</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  Aún no hay claves. Crea una para conectar otras herramientas.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{key.name}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-slate-600">
                      {key.keyPrefix}…
                    </code>
                    <p className="mt-0.5 text-[11px] text-slate-400">Solo prefijo; la clave completa no se vuelve a mostrar</p>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-600">{shortPermissions(key.scopes)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatLastUsed(key.lastUsedAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        key.revokedAt ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${key.revokedAt ? "bg-rose-500" : "bg-emerald-500"}`}
                      />
                      {key.revokedAt ? "Revocada" : "Activa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!key.revokedAt ? (
                      <button
                        type="button"
                        onClick={() => revoke(key.id)}
                        className="text-sm font-medium text-rose-600 hover:text-rose-500"
                      >
                        Revocar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
