"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Select } from "@/components/select";
import { Button, PageHeader } from "@/components/ui";

type Task = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | string;
  priority: "low" | "medium" | "high" | string;
  dueAt?: string | null;
  contact?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
};

type Contact = { id: string; name: string };

type ColumnId = "pending" | "in_progress" | "completed";

const COLUMNS: {
  id: ColumnId;
  label: string;
  dot: string;
  statusLabel: string;
  statusClass: string;
}[] = [
  {
    id: "pending",
    label: "To do",
    dot: "bg-amber-400",
    statusLabel: "Pendiente",
    statusClass: "bg-violet-50 text-violet-700",
  },
  {
    id: "in_progress",
    label: "In Progress",
    dot: "bg-sky-500",
    statusLabel: "En curso",
    statusClass: "bg-sky-50 text-sky-700",
  },
  {
    id: "completed",
    label: "Done",
    dot: "bg-fuchsia-500",
    statusLabel: "Completada",
    statusClass: "bg-emerald-50 text-emerald-700",
  },
];

const PRIORITY: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-sky-50 text-sky-700" },
  medium: { label: "Medium", className: "bg-amber-50 text-amber-700" },
  high: { label: "High", className: "bg-rose-50 text-rose-700" },
};

function formatDue(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function PriorityPill({ priority }: { priority: string }) {
  const meta = PRIORITY[priority] || PRIORITY.medium;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [view, setView] = useState<"board" | "list">("board");
  const [addingIn, setAddingIn] = useState<ColumnId | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  async function load() {
    setTasks(await api("/tasks"));
  }

  useEffect(() => {
    load();
    api<Contact[]>("/contacts").then(setContacts).catch(() => setContacts([]));
  }, []);

  const byStatus = useMemo(() => {
    const map: Record<ColumnId, Task[]> = {
      pending: [],
      in_progress: [],
      completed: [],
    };
    for (const task of tasks) {
      const key = (COLUMNS.some((c) => c.id === task.status) ? task.status : "pending") as ColumnId;
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  async function createTask(e: FormEvent<HTMLFormElement>, status: ColumnId) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dueDate = String(form.get("dueDate") || "");
    const dueTime = String(form.get("dueTime") || "");
    const dueAt =
      dueDate && dueTime
        ? new Date(`${dueDate}T${dueTime}`).toISOString()
        : dueDate
          ? new Date(`${dueDate}T12:00`).toISOString()
          : undefined;
    await api("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        contactId: form.get("contactId") || undefined,
        dueAt,
        priority: "medium",
        status,
      }),
    });
    setAddingIn(null);
    load();
  }

  async function move(taskId: string, status: ColumnId) {
    const current = tasks.find((t) => t.id === taskId);
    if (!current || current.status === status) return;
    setTasks((list) => list.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await api(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } finally {
      load();
    }
  }

  function onCardDragStart(e: DragEvent<HTMLElement>, task: Task) {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(task.id);
    setMenuId(null);
  }

  function onCardDragEnd() {
    setDraggingId(null);
    setOverColumn(null);
  }

  function onColumnDragOver(e: DragEvent<HTMLElement>, columnId: ColumnId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverColumn((current) => (current === columnId ? current : columnId));
  }

  function onColumnDrop(e: DragEvent<HTMLElement>, columnId: ColumnId) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setOverColumn(null);
    if (taskId) void move(taskId, columnId);
  }

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle="Organiza el seguimiento del equipo en un tablero."
        actions={
          <Button
            type="button"
            onClick={() => {
              setView("board");
              setAddingIn("pending");
            }}
          >
            Nueva tarea
          </Button>
        }
      />

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {(
          [
            { id: "board" as const, label: "Board" },
            { id: "list" as const, label: "List" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              view === tab.id
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "board" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((column) => {
            const items = byStatus[column.id];
            return (
              <section
                key={column.id}
                onDragOver={(e) => onColumnDragOver(e, column.id)}
                onDragLeave={() => setOverColumn((current) => (current === column.id ? null : current))}
                onDrop={(e) => onColumnDrop(e, column.id)}
                className={`flex min-h-[420px] flex-col rounded-2xl border bg-slate-50/70 p-3 transition ${
                  overColumn === column.id ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"
                }`}
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
                  <h2 className="text-sm font-semibold text-slate-800">{column.label}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                    {items.length}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Añadir en ${column.label}`}
                      onClick={() => setAddingIn(addingIn === column.id ? null : column.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-indigo-600"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {addingIn === column.id ? (
                  <form
                    onSubmit={(e) => createTask(e, column.id)}
                    className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <input name="title" placeholder="Título de la tarea" required autoFocus />
                    <Select
                      name="contactId"
                      placeholder="Contacto (opcional)"
                      options={[
                        { value: "", label: "Sin contacto" },
                        ...contacts.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-500">Fecha</span>
                        <input name="dueDate" type="date" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-500">Hora</span>
                        <input name="dueTime" type="time" />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">Crear</Button>
                      <Button type="button" variant="ghost" onClick={() => setAddingIn(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : null}

                <div className="flex flex-1 flex-col gap-3">
                  {items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-8 text-center text-sm text-slate-400">
                      Arrastra una tarea aquí
                    </p>
                  ) : (
                    items.map((task) => {
                      const columnMeta = COLUMNS.find((c) => c.id === task.status) || column;
                      return (
                        <article
                          key={task.id}
                          draggable
                          onDragStart={(e) => onCardDragStart(e, task)}
                          onDragEnd={onCardDragEnd}
                          className={`cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
                            draggingId === task.id ? "opacity-60 ring-2 ring-indigo-200" : "hover:border-slate-300"
                          }`}
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${columnMeta.statusClass}`}
                            >
                              {columnMeta.statusLabel}
                            </span>
                            <div className="relative">
                              <button
                                type="button"
                                aria-label="Acciones"
                                onClick={() => setMenuId(menuId === task.id ? null : task.id)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                              >
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M6 10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm5.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm5.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                                </svg>
                              </button>
                              {menuId === task.id ? (
                                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                  {COLUMNS.filter((c) => c.id !== task.status).map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                      onClick={() => {
                                        setMenuId(null);
                                        void move(task.id, c.id);
                                      }}
                                    >
                                      Mover a {c.label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {task.contact?.name
                              ? `Seguimiento con ${task.contact.name}`
                              : "Sin contacto vinculado"}
                          </p>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {task.assignee ? (
                                <span
                                  title={task.assignee.name}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700"
                                >
                                  {initials(task.assignee.name) || "?"}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Sin asignar</span>
                              )}
                            </div>
                            <PriorityPill priority={task.priority} />
                          </div>

                          {task.dueAt ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M3.5 3.75a.75.75 0 0 1 .75-.75h1.5V2a.75.75 0 0 1 1.5 0v1h5V2a.75.75 0 0 1 1.5 0v1h1.5a.75.75 0 0 1 .75.75V6h-14V3.75ZM3.5 7.5h13v8.75a.75.75 0 0 1-.75.75h-11.5a.75.75 0 0 1-.75-.75V7.5Z" />
                              </svg>
                              {formatDue(task.dueAt)}
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Vence</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No hay tareas todavía.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">{task.title}</td>
                    <td className="px-4 py-3 text-slate-600">{task.contact?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <PriorityPill priority={task.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        className="w-40"
                        value={task.status}
                        options={COLUMNS.map((c) => ({ value: c.id, label: c.label }))}
                        onChange={(status) => move(task.id, status as ColumnId)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDue(task.dueAt) || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
