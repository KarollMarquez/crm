"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

export function Select({
  name,
  value,
  defaultValue = "",
  options,
  placeholder = "Seleccionar",
  onChange,
  className = "",
  required,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(value ?? defaultValue);
  const root = useRef<HTMLDivElement>(null);
  const current = value !== undefined ? value : internal;
  const selected = options.find((o) => o.value === current);

  useEffect(() => {
    if (value !== undefined) setInternal(value);
  }, [value]);

  useEffect(() => {
    const form = root.current?.closest("form");
    const onReset = () => setInternal(defaultValue);
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, [defaultValue]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(next: string) {
    setInternal(next);
    setOpen(false);
    onChange?.(next);
  }

  return (
    <div ref={root} className={`relative ${className || "w-full"}`}>
      {name ? <input type="hidden" name={name} value={current} required={required && !current} /> : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm outline-none transition hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      >
        <span className={selected ? "" : "text-slate-400"}>{selected?.label || placeholder}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              className={`flex w-full rounded-lg px-3 py-2 text-left text-sm ${
                o.value === current
                  ? "bg-indigo-600 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
