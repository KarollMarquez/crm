"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button, PageHeader } from "@/components/ui";
import { DateTimeFields } from "@/components/date-time-fields";

type Appointment = {
  id: string;
  publicNumber?: number | string;
  title?: string | null;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled" | "completed" | "no_show";
  notes?: string | null;
  source?: string | null;
  contact: { id: string; publicNumber?: number | string; name: string; phone?: string | null; email?: string | null };
};

type View = "month" | "week" | "day";
type Modal =
  | { type: "create"; startsAt: Date }
  | { type: "detail"; appointment: Appointment }
  | { type: "reschedule"; appointment: Appointment }
  | null;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOUR_START = 7;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date: Date) {
  const start = startOfDay(date);
  const weekday = start.getDay();
  return addDays(start, weekday === 0 ? -6 : 1 - weekday);
}

function monthCells(cursor: Date) {
  const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function snapTime(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const snapped = minutes < 8 ? 0 : minutes < 23 ? 15 : minutes < 38 ? 30 : minutes < 53 ? 45 : 60;
  if (snapped === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(snapped);
  }
  if (next.getHours() < HOUR_START) next.setHours(HOUR_START, 0, 0, 0);
  if (next.getHours() >= HOUR_END) next.setHours(HOUR_END - 1, 45, 0, 0);
  return next;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function formatRange(start: string, end: string) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function statusLabel(status: Appointment["status"]) {
  if (status === "cancelled") return "Cancelada";
  if (status === "completed") return "Completada";
  if (status === "no_show") return "No asistió";
  return "Agendada";
}

function rangeFor(view: View, cursor: Date) {
  if (view === "day") {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1) };
  }
  if (view === "week") {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }
  const cells = monthCells(cursor);
  return { from: cells[0], to: addDays(cells[cells.length - 1], 1) };
}

function titleFor(view: View, cursor: Date) {
  if (view === "day") {
    return cursor.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = start.toLocaleDateString("es", { day: "numeric", month: sameMonth ? undefined : "short" });
    const endLabel = end.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
    return `${startLabel} – ${endLabel}`;
  }
  return cursor.toLocaleDateString("es", { month: "long", year: "numeric" });
}

function eventStyle(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const startHours = start.getHours() + start.getMinutes() / 60;
  const endHours = end.getHours() + end.getMinutes() / 60;
  const top = ((Math.max(startHours, HOUR_START) - HOUR_START) / (HOUR_END - HOUR_START)) * 100;
  const height = (Math.max(endHours - Math.max(startHours, HOUR_START), 0.5) / (HOUR_END - HOUR_START)) * 100;
  return { top: `${top}%`, height: `${Math.min(height, 100 - top)}%` };
}

export default function AgendaPage() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const today = startOfDay(new Date());

  const load = useCallback(async () => {
    const rows = await api<Appointment[]>(
      `/appointments?from=${range.from.toISOString()}&to=${range.to.toISOString()}`,
    );
    setAppointments(rows);
  }, [range.from, range.to]);

  useEffect(() => {
    load().catch(() => setAppointments([]));
  }, [load]);

  function shift(direction: number) {
    if (view === "day") setCursor((current) => addDays(current, direction));
    else if (view === "week") setCursor((current) => addDays(current, direction * 7));
    else setCursor((current) => addMonths(current, direction));
  }

  function goToCurrent(next: View) {
    setCursor(startOfDay(new Date()));
    setView(next);
  }

  function onDay(date: Date, hour = 9) {
    const startsAt = new Date(date);
    startsAt.setHours(hour, 0, 0, 0);
    setError("");
    setModal({ type: "create", startsAt: snapTime(startsAt) });
  }

  async function create(startsAt: Date, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone") || undefined,
          email: form.get("email") || undefined,
          notes: form.get("notes") || undefined,
          startsAt: startsAt.toISOString(),
          source: "manual",
        }),
      });
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cita");
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppointment(id: string) {
    setSaving(true);
    setError("");
    try {
      await api(`/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar");
    } finally {
      setSaving(false);
    }
  }

  async function rescheduleAppointment(id: string, startsAt: Date) {
    setSaving(true);
    setError("");
    try {
      await api(`/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ startsAt: startsAt.toISOString() }),
      });
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reagendar");
    } finally {
      setSaving(false);
    }
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = startOfDay(new Date(appointment.startsAt)).toISOString();
      const list = map.get(key) || [];
      list.push(appointment);
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));

  return (
    <div className="flex h-full flex-col p-6">
      <PageHeader
        title="Agenda"
        subtitle="Citas agendadas. Al crear una, el contacto y el lead pasan a Cita agendada."
        actions={
          <Button type="button" onClick={() => {
            setError("");
            setModal({ type: "create", startsAt: snapTime(new Date()) });
          }}>
            Nueva cita
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => shift(-1)}>
            Anterior
          </Button>
          <Button type="button" variant="ghost" onClick={() => setCursor(startOfDay(new Date()))}>
            Hoy
          </Button>
          <Button type="button" variant="ghost" onClick={() => shift(1)}>
            Siguiente
          </Button>
          <h2 className="ml-2 text-base font-semibold capitalize">{titleFor(view, cursor)}</h2>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
          {(["month", "week", "day"] as View[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-lg px-3 py-1.5 ${
                view === item ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => goToCurrent(item)}
            >
              {item === "month" ? "Mes" : item === "week" ? "Semana" : "Día"}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {view === "month" ? (
          <MonthView
            cursor={cursor}
            today={today}
            byDay={byDay}
            onDay={onDay}
            onSelect={(appointment) => {
              setError("");
              setModal({ type: "detail", appointment });
            }}
          />
        ) : view === "week" ? (
          <TimeGrid
            days={weekDays}
            today={today}
            byDay={byDay}
            onSlot={onDay}
            onSelect={(appointment) => {
              setError("");
              setModal({ type: "detail", appointment });
            }}
          />
        ) : (
          <TimeGrid
            days={[startOfDay(cursor)]}
            today={today}
            byDay={byDay}
            onSlot={onDay}
            onSelect={(appointment) => {
              setError("");
              setModal({ type: "detail", appointment });
            }}
          />
        )}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-900/40 p-4" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-lg overflow-visible rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {modal.type === "create" ? (
              <CreateAppointmentForm
                initialStartsAt={modal.startsAt}
                error={error}
                saving={saving}
                onClose={() => setModal(null)}
                onSubmit={(startsAt, event) => create(startsAt, event)}
              />
            ) : modal.type === "reschedule" ? (
              <RescheduleAppointmentForm
                appointment={modal.appointment}
                error={error}
                saving={saving}
                onClose={() => setModal(null)}
                onBack={() => {
                  setError("");
                  setModal({ type: "detail", appointment: modal.appointment });
                }}
                onSubmit={(startsAt) => rescheduleAppointment(modal.appointment.id, startsAt)}
              />
            ) : (
              <AppointmentDetail
                appointment={modal.appointment}
                error={error}
                saving={saving}
                onClose={() => setModal(null)}
                onReschedule={() => {
                  setError("");
                  setModal({ type: "reschedule", appointment: modal.appointment });
                }}
                onCancel={() => cancelAppointment(modal.appointment.id)}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CreateAppointmentForm({
  initialStartsAt,
  error,
  saving,
  onClose,
  onSubmit,
}: {
  initialStartsAt: Date;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (startsAt: Date, event: FormEvent<HTMLFormElement>) => void;
}) {
  const [startsAt, setStartsAt] = useState(initialStartsAt);

  return (
    <>
      <h3 className="mb-4 text-lg font-semibold">Nueva cita</h3>
      <form onSubmit={(event) => onSubmit(startsAt, event)} className="space-y-3">
        <input name="name" placeholder="Nombre del paciente" required />
        <input name="phone" placeholder="Teléfono" required />
        <input name="email" type="email" placeholder="Email" />
        <DateTimeFields value={startsAt} onChange={setStartsAt} />
        <textarea name="notes" placeholder="Notas (opcional)" rows={2} />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Agendar"}
          </Button>
        </div>
      </form>
    </>
  );
}

function MonthView({
  cursor,
  today,
  byDay,
  onDay,
  onSelect,
}: {
  cursor: Date;
  today: Date;
  byDay: Map<string, Appointment[]>;
  onDay: (date: Date) => void;
  onSelect: (appointment: Appointment) => void;
}) {
  const cells = monthCells(cursor);
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-medium text-slate-500">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((date) => {
          const key = startOfDay(date).toISOString();
          const items = byDay.get(key) || [];
          const outside = date.getMonth() !== cursor.getMonth();
          const isToday = sameDay(date, today);
          return (
            <button
              key={key}
              type="button"
              className={`flex min-h-0 flex-col overflow-hidden border-b border-r border-slate-100 p-1.5 text-left hover:bg-slate-50 ${
                outside ? "bg-slate-50/60" : ""
              }`}
              onClick={() => onDay(date)}
            >
              <span
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? "bg-indigo-600 font-semibold text-white" : outside ? "text-slate-400" : "text-slate-700"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="space-y-0.5 overflow-hidden">
                {items.slice(0, 3).map((appointment) => (
                  <span
                    key={appointment.id}
                    role="presentation"
                    className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${chipClass(appointment.status)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(appointment);
                    }}
                  >
                    {formatTime(appointment.startsAt)} {appointment.contact.name}
                  </span>
                ))}
                {items.length > 3 ? (
                  <span className="px-1 text-[11px] text-slate-500">+{items.length - 3} más</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  today,
  byDay,
  onSlot,
  onSelect,
}: {
  days: Date[];
  today: Date;
  byDay: Map<string, Appointment[]>;
  onSlot: (date: Date, hour: number) => void;
  onSelect: (appointment: Appointment) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="sticky top-0 z-10 grid border-b border-slate-100 bg-white" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((date) => (
          <div
            key={date.toISOString()}
            className={`border-l border-slate-100 px-2 py-2 text-center text-sm ${sameDay(date, today) ? "text-indigo-700" : "text-slate-600"}`}
          >
            <div className="text-xs uppercase">{date.toLocaleDateString("es", { weekday: "short" })}</div>
            <div className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full ${sameDay(date, today) ? "bg-indigo-600 font-semibold text-white" : ""}`}>
              {date.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div className="relative">
          {HOURS.map((hour) => (
            <div key={hour} className="h-12 border-b border-transparent pr-2 text-right text-[11px] leading-[48px] text-slate-400">
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((date) => {
          const key = startOfDay(date).toISOString();
          const items = byDay.get(key) || [];
          return (
            <div key={key} className="relative border-l border-slate-100">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className="block h-12 w-full border-b border-slate-100 hover:bg-indigo-50/60"
                  onClick={() => onSlot(date, hour)}
                />
              ))}
              {items.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  className={`absolute left-1 right-1 overflow-hidden rounded-lg px-2 py-1 text-left text-xs shadow-sm ${chipClass(appointment.status)}`}
                  style={eventStyle(appointment.startsAt, appointment.endsAt)}
                  onClick={() => onSelect(appointment)}
                >
                  <div className="font-medium">{formatTime(appointment.startsAt)}</div>
                  <div className="truncate">{appointment.contact.name}</div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function chipClass(status: Appointment["status"]) {
  if (status === "cancelled") return "bg-slate-100 text-slate-400 line-through";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "no_show") return "bg-rose-100 text-rose-800";
  return "bg-indigo-100 text-indigo-800";
}

function AppointmentDetail({
  appointment,
  error,
  saving,
  onClose,
  onReschedule,
  onCancel,
}: {
  appointment: Appointment;
  error: string;
  saving: boolean;
  onClose: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <h3 className="mb-1 text-lg font-semibold">{appointment.contact.name}</h3>
      <p className="mb-4 text-sm text-slate-500">{statusLabel(appointment.status)}</p>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Horario</dt>
          <dd>{formatRange(appointment.startsAt, appointment.endsAt)}</dd>
        </div>
        {appointment.contact.phone ? (
          <div>
            <dt className="text-xs text-slate-400">Teléfono</dt>
            <dd>{appointment.contact.phone}</dd>
          </div>
        ) : null}
        {appointment.contact.email ? (
          <div>
            <dt className="text-xs text-slate-400">Email</dt>
            <dd>{appointment.contact.email}</dd>
          </div>
        ) : null}
        {appointment.notes ? (
          <div>
            <dt className="text-xs text-slate-400">Notas</dt>
            <dd>{appointment.notes}</dd>
          </div>
        ) : null}
      </dl>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Link href={`/contacts/${appointment.contact.id}`} className="mr-auto text-sm text-indigo-600">
          Ver contacto
        </Link>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        {appointment.status === "scheduled" ? (
          <>
            <Button type="button" disabled={saving} onClick={onReschedule}>
              Reagendar
            </Button>
            <Button type="button" variant="danger" disabled={saving} onClick={onCancel}>
              {saving ? "Cancelando…" : "Cancelar cita"}
            </Button>
          </>
        ) : null}
      </div>
    </>
  );
}

function RescheduleAppointmentForm({
  appointment,
  error,
  saving,
  onClose,
  onBack,
  onSubmit,
}: {
  appointment: Appointment;
  error: string;
  saving: boolean;
  onClose: () => void;
  onBack: () => void;
  onSubmit: (startsAt: Date) => void;
}) {
  const [startsAt, setStartsAt] = useState(() => new Date(appointment.startsAt));
  const durationMs = new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime();
  const endsAt = new Date(startsAt.getTime() + durationMs);

  return (
    <>
      <h3 className="mb-1 text-lg font-semibold">Reagendar cita</h3>
      <p className="mb-4 text-sm text-slate-500">{appointment.contact.name}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(startsAt);
        }}
        className="space-y-3"
      >
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Horario actual</p>
          <p className="text-sm text-slate-600">{formatRange(appointment.startsAt, appointment.endsAt)}</p>
        </div>
        <DateTimeFields value={startsAt} onChange={setStartsAt} />
        <p className="text-xs text-slate-500">
          Nuevo horario: {formatRange(startsAt.toISOString(), endsAt.toISOString())} (se mantiene la duración)
        </p>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            Volver
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar nuevo horario"}
          </Button>
        </div>
      </form>
    </>
  );
}
