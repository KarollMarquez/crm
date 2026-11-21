"use client";

import Link from "next/link";
import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { CopyValue } from "@/components/copy-value";
import { Button } from "@/components/ui";

type Stage = {
  id: string;
  name: string;
  slug: string;
  color: string;
  position: number;
  publicNumber?: number | string;
};
type Lead = {
  id: string;
  stageId: string | null;
  status: string;
  service?: string | null;
  contact: { id: string; name: string; phone?: string | null; email?: string | null };
};
type Board = { pipeline: { id: string; stages: Stage[] }; leads: Lead[] };

const PAGE = 12;
const COLORS = ["#64748b", "#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444", "#06b6d4", "#ec4899"];

export default function PipelinePage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(COLORS[0]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  async function load() {
    setBoard(await api("/leads/board"));
  }
  useEffect(() => {
    load();
  }, []);

  const firstStageId = board?.pipeline.stages[0]?.id;

  async function addContact(e: FormEvent<HTMLFormElement>, stageId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api("/deals/leads", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone") || undefined,
        email: form.get("email") || undefined,
        stageId,
        pipelineId: board?.pipeline.id,
      }),
    });
    setAddingIn(null);
    load();
  }

  async function move(leadId: string, stageId: string) {
    setBoard((current) => {
      if (!current) return current;
      return {
        ...current,
        leads: current.leads.map((lead) => (lead.id === leadId ? { ...lead, stageId } : lead)),
      };
    });
    try {
      await api(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ stageId }) });
    } finally {
      load();
    }
  }

  function onCardDragStart(e: DragEvent<HTMLElement>, lead: Lead) {
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(lead.id);
  }

  function onCardDragEnd() {
    setDraggingId(null);
    setOverStageId(null);
  }

  function onColumnDragOver(e: DragEvent<HTMLElement>, stageId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverStageId((current) => (current === stageId ? current : stageId));
  }

  function onColumnDrop(e: DragEvent<HTMLElement>, stageId: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setOverStageId(null);
    if (!leadId) return;
    const lead = board?.leads.find((item) => item.id === leadId);
    const from = lead?.stageId || firstStageId;
    if (!from || from === stageId) return;
    move(leadId, stageId);
  }

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const lead of board?.leads || []) {
      const stageId = lead.stageId || firstStageId;
      if (!stageId) continue;
      (map[stageId] ||= []).push(lead);
    }
    return map;
  }, [board, firstStageId]);

  if (!board) return <div className="grid h-full place-items-center text-slate-500">Cargando…</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Pipeline</h1>
          <p className="text-sm text-slate-500">
            Aquí puedes gestionar tus leads y moverlos entre etapas.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          Editar etapas
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-4">
        {board.pipeline.stages.map((stage) => {
          const all = byStage[stage.id] || [];
          const take = visible[stage.id] ?? PAGE;
          const shown = all.slice(0, take);
          const isFirst = stage.id === firstStageId;
          return (
            <section
              key={stage.id}
              onDragOver={(e) => onColumnDragOver(e, stage.id)}
              onDragEnter={(e) => {
                e.preventDefault();
                setOverStageId(stage.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOverStageId((current) => (current === stage.id ? null : current));
                }
              }}
              onDrop={(e) => onColumnDrop(e, stage.id)}
              className={`flex w-80 shrink-0 flex-col rounded-2xl transition ${
                overStageId === stage.id ? "bg-indigo-50 ring-2 ring-indigo-300" : "bg-slate-100/80"
              }`}
            >
              <header className="flex items-start justify-between gap-2 px-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                    <span className="font-medium text-slate-800">{stage.name}</span>
                  </div>
                  <div className="ml-4 mt-1">
                    {stage.publicNumber != null ? <CopyValue asId value={stage.publicNumber} /> : null}
                  </div>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{all.length}</span>
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                {shown.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => onCardDragStart(e, lead)}
                    onDragEnd={onCardDragEnd}
                    className={`cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
                      draggingId === lead.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/contacts/${lead.contact.id}`}
                        draggable={false}
                        className="font-medium text-slate-900 hover:text-indigo-700"
                      >
                        {lead.contact.name}
                      </Link>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-rose-600 hover:text-rose-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            !confirm(
                              `¿Eliminar el lead de ${lead.contact.name}? El contacto se mantiene.`,
                            )
                          ) {
                            return;
                          }
                          api(`/leads/${lead.id}`, { method: "DELETE" }).then(load);
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                      {lead.contact.phone ? <div>{lead.contact.phone}</div> : null}
                      {lead.contact.email ? <div>{lead.contact.email}</div> : null}
                    </div>
                  </article>
                ))}

                {all.length > take ? (
                  <button
                    type="button"
                    className="w-full py-2 text-xs font-medium text-indigo-600"
                    onClick={() => setVisible((v) => ({ ...v, [stage.id]: take + PAGE }))}
                  >
                    Cargar más
                  </button>
                ) : null}

                {isFirst ? (
                  addingIn === stage.id ? (
                    <form
                      onSubmit={(e) => addContact(e, stage.id)}
                      className="space-y-2 rounded-xl border border-dashed border-indigo-200 bg-white p-3"
                    >
                      <input name="name" placeholder="Nombre" required />
                      <input name="phone" placeholder="Teléfono" />
                      <input name="email" type="email" placeholder="Email" />
                      <div className="flex gap-2">
                        <Button type="submit">Guardar</Button>
                        <Button type="button" variant="ghost" onClick={() => setAddingIn(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingIn(stage.id)}
                      className="w-full rounded-xl border border-dashed border-slate-300 bg-white/70 py-2.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                    >
                      + Añadir
                    </button>
                  )
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Etapas del pipeline</h2>
              <button type="button" className="text-sm text-slate-500" onClick={() => setEditing(false)}>
                Cerrar
              </button>
            </div>
            <div className="space-y-3">
              {board.pipeline.stages.map((stage, index) => (
                <div key={stage.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={stage.name}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== stage.name) {
                          api(`/pipelines/stages/${stage.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ name: e.target.value }),
                          }).then(load);
                        }
                      }}
                    />
                    <input
                      type="color"
                      className="h-10 w-12 p-1"
                      defaultValue={stage.color}
                      onChange={(e) =>
                        api(`/pipelines/stages/${stage.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ color: e.target.value }),
                        }).then(load)
                      }
                    />
                    <button
                      type="button"
                      className="text-xs text-slate-500"
                      disabled={index === 0}
                      onClick={() => {
                        const ids = board.pipeline.stages.map((s) => s.id);
                        [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                        api(`/pipelines/${board.pipeline.id}/reorder`, {
                          method: "POST",
                          body: JSON.stringify({ stageIds: ids }),
                        }).then(load);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-500"
                      disabled={index === board.pipeline.stages.length - 1}
                      onClick={() => {
                        const ids = board.pipeline.stages.map((s) => s.id);
                        [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                        api(`/pipelines/${board.pipeline.id}/reorder`, {
                          method: "POST",
                          body: JSON.stringify({ stageIds: ids }),
                        }).then(load);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-xs text-rose-600"
                      onClick={() =>
                        api(`/pipelines/stages/${stage.id}`, { method: "DELETE" }).then(load)
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                  {stage.publicNumber != null ? <CopyValue asId value={stage.publicNumber} /> : null}
                </div>
              ))}
            </div>
            <form
              className="mt-5 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!draftName.trim()) return;
                await api(`/pipelines/${board.pipeline.id}/stages`, {
                  method: "POST",
                  body: JSON.stringify({ name: draftName, color: draftColor }),
                });
                setDraftName("");
                load();
              }}
            >
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Nueva etapa"
              />
              <input
                type="color"
                className="h-10 w-12 p-1"
                value={draftColor}
                onChange={(e) => setDraftColor(e.target.value)}
              />
              <Button type="submit">Añadir</Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
