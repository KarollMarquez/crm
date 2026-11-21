"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Select } from "@/components/select";
import { Button, Card, PageHeader } from "@/components/ui";

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "agent", label: "Agent" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_PILL: Record<string, string> = {
  owner: "bg-violet-50 text-violet-700 ring-violet-200",
  admin: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  agent: "bg-sky-50 text-sky-700 ring-sky-200",
  viewer: "bg-slate-100 text-slate-600 ring-slate-200",
};

type Member = {
  id: string;
  role: string;
  createdAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt?: string;
    updatedAt?: string;
  };
};

type Settings = {
  name: string;
  plan: string;
};

type Toast = { message: string; undo?: () => void } | null;
type Modal =
  | { type: "invite" }
  | { type: "edit"; member: Member }
  | { type: "role"; member: Member }
  | { type: "view"; member: Member }
  | null;

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function RolePill({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        ROLE_PILL[role] || ROLE_PILL.viewer
      }`}
    >
      {ROLES.find((r) => r.value === role)?.label || role}
    </span>
  );
}

function UserMenu({
  member,
  onView,
  onEdit,
  onRole,
  onDelete,
}: {
  member: Member;
  onView: () => void;
  onEdit: () => void;
  onRole: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={root} className="relative flex justify-end">
      <button
        type="button"
        aria-label={`Acciones de ${member.user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onView();
            }}
          >
            Ver perfil
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Editar detalles
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onRole();
            }}
          >
            Cambiar permiso
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <span aria-hidden>!</span>
            Eliminar usuario
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  async function load() {
    setSettings(await api("/settings"));
    setMembers(await api("/users"));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const pageCount = Math.max(1, Math.ceil(members.length / pageSize));
  const pageMembers = members.slice((page - 1) * pageSize, page * pageSize);

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          role: form.get("role"),
          password: form.get("password"),
        }),
      });
      setModal(null);
      await load();
      setToast({ message: `Invitación enviada a ${String(form.get("name") || "usuario")}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar");
    }
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (modal?.type !== "edit") return;
    setError("");
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "");
    try {
      await api(`/users/${modal.member.user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setModal(null);
      await load();
      setToast({ message: `Detalles de “${name}” actualizados` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function saveRole(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (modal?.type !== "role") return;
    setError("");
    const form = new FormData(e.currentTarget);
    const role = String(form.get("role") || "");
    const previous = modal.member.role;
    try {
      await api(`/users/${modal.member.user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setModal(null);
      await load();
      setToast({
        message: `Permiso de “${modal.member.user.name}” actualizado`,
        undo: async () => {
          await api(`/users/${modal.member.user.id}/role`, {
            method: "PATCH",
            body: JSON.stringify({ role: previous }),
          });
          await load();
          setToast({ message: "Permiso restaurado" });
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el permiso");
    }
  }

  async function removeMember(member: Member) {
    if (!confirm(`¿Quitar a ${member.user.name} de la organización?`)) return;
    try {
      await api(`/users/${member.user.id}`, { method: "DELETE" });
      await load();
      setToast({ message: `“${member.user.name}” eliminado` });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "No se pudo eliminar" });
    }
  }

  if (!settings) return <p>Cargando…</p>;

  return (
    <div>
      <PageHeader
        title="Configuración"
        subtitle={`Plan: ${settings.plan}`}
        actions={<Button onClick={() => { setError(""); setModal({ type: "invite" }); }}>Invitar usuario</Button>}
      />

      <Card className="mb-4 overflow-visible p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-medium text-slate-900">Usuarios</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {members.length} {members.length === 1 ? "miembro" : "miembros"} en la organización
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Permiso</th>
                <th className="px-5 py-3">Última actividad</th>
                <th className="px-5 py-3">Fecha de alta</th>
                <th className="px-5 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {pageMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    Aún no hay usuarios.
                  </td>
                </tr>
              ) : (
                pageMembers.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                          {initials(m.user.name) || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{m.user.name}</p>
                          <p className="truncate text-xs text-slate-500">{m.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <RolePill role={m.role} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                      {formatDate(m.user.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                      {formatDate(m.user.createdAt || m.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <UserMenu
                        member={m}
                        onView={() => setModal({ type: "view", member: m })}
                        onEdit={() => {
                          setError("");
                          setModal({ type: "edit", member: m });
                        }}
                        onRole={() => {
                          setError("");
                          setModal({ type: "role", member: m });
                        }}
                        onDelete={() => removeMember(m)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              Página {page} de {pageCount}
            </p>
            <div className="flex gap-1">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`h-8 w-8 rounded-lg text-sm font-medium ${
                    n === page
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {modal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            {modal.type === "invite" ? (
              <>
                <h3 className="mb-3 text-lg font-semibold">Invitar usuario</h3>
                <form className="grid gap-2" onSubmit={invite}>
                  <input name="name" placeholder="Nombre" required />
                  <input name="email" type="email" placeholder="Email" required />
                  <input name="password" placeholder="Contraseña temporal" required minLength={8} />
                  <Select name="role" defaultValue="agent" options={ROLES} />
                  {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <Button type="submit">Invitar</Button>
                    <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </>
            ) : null}

            {modal.type === "edit" ? (
              <>
                <h3 className="mb-3 text-lg font-semibold">Editar detalles</h3>
                <form className="grid gap-2" onSubmit={saveEdit}>
                  <input name="name" defaultValue={modal.member.user.name} required />
                  <input value={modal.member.user.email} disabled className="opacity-70" />
                  {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <Button type="submit">Guardar</Button>
                    <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </>
            ) : null}

            {modal.type === "role" ? (
              <>
                <h3 className="mb-3 text-lg font-semibold">Cambiar permiso</h3>
                <p className="mb-3 text-sm text-slate-500">{modal.member.user.name}</p>
                <form className="grid gap-2" onSubmit={saveRole}>
                  <Select name="role" defaultValue={modal.member.role} options={ROLES} />
                  {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <Button type="submit">Guardar</Button>
                    <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </>
            ) : null}

            {modal.type === "view" ? (
              <>
                <h3 className="mb-3 text-lg font-semibold">Perfil</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-slate-500">Nombre:</span> {modal.member.user.name}
                  </p>
                  <p>
                    <span className="text-slate-500">Email:</span> {modal.member.user.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-slate-500">Permiso:</span>
                    <RolePill role={modal.member.role} />
                  </p>
                  <p>
                    <span className="text-slate-500">Alta:</span>{" "}
                    {formatDate(modal.member.user.createdAt || modal.member.createdAt)}
                  </p>
                  <p>
                    <span className="text-slate-500">Última actividad:</span>{" "}
                    {formatDate(modal.member.user.updatedAt)}
                  </p>
                </div>
                <div className="mt-4">
                  <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                    Cerrar
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p>{toast.message}</p>
            {toast.undo ? (
              <button
                type="button"
                className="mt-1 text-xs font-medium text-indigo-300 hover:text-indigo-200"
                onClick={() => toast.undo?.()}
              >
                Deshacer
              </button>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="text-slate-400 hover:text-white"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
