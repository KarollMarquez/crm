"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/select";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function timeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function timeOptions(fromHour = 7, toHour = 20, stepMinutes = 15) {
  const options: { value: string; label: string }[] = [];
  for (let minutes = fromHour * 60; minutes < toHour * 60; minutes += stepMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const value = `${pad(hours)}:${pad(mins)}`;
    const label = new Date(2000, 0, 1, hours, mins).toLocaleTimeString("es", {
      hour: "numeric",
      minute: "2-digit",
    });
    options.push({ value, label });
  }
  return options;
}

const TIMES = timeOptions();

export function DateTimeFields({
  value,
  onChange,
}: {
  value: Date;
  onChange: (next: Date) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <DateField
        value={value}
        onChange={(date) => {
          const next = new Date(date);
          next.setHours(value.getHours(), value.getMinutes(), 0, 0);
          onChange(next);
        }}
      />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Hora</span>
        <Select
          value={timeValue(value)}
          options={TIMES}
          onChange={(nextTime) => {
            const [hours, minutes] = nextTime.split(":").map(Number);
            const next = new Date(value);
            next.setHours(hours, minutes, 0, 0);
            onChange(next);
          }}
        />
      </label>
    </div>
  );
}

function DateField({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const root = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  const cells = useMemo(() => monthCells(month), [month]);

  useEffect(() => {
    setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = value.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div ref={root} className="relative">
      <span className="mb-1 block text-xs font-medium text-slate-500">Fecha</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm outline-none transition hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      >
        <span className="capitalize">{label}</span>
        <CalendarIcon />
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 w-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <div className="text-sm font-semibold capitalize">
              {month.toLocaleDateString("es", { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const outside = date.getMonth() !== month.getMonth();
              const selected = sameDay(date, value);
              const isToday = sameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(date);
                    setOpen(false);
                  }}
                  className={`m-0.5 grid h-8 w-8 place-items-center rounded-full text-sm ${
                    selected
                      ? "bg-indigo-600 font-semibold text-white"
                      : isToday
                        ? "font-semibold text-indigo-700 ring-1 ring-indigo-200"
                        : outside
                          ? "text-slate-300 hover:bg-slate-50"
                          : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            onClick={() => {
              onChange(today);
              setOpen(false);
            }}
          >
            Hoy
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4.5" width="14" height="12" rx="2" />
      <path d="M3 8h14M7 3v3M13 3v3" strokeLinecap="round" />
    </svg>
  );
}
