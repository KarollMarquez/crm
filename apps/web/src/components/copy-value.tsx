"use client";

import { MouseEvent, useState } from "react";

export function CopyValue({
  label,
  value,
  mono = true,
  asId = false,
}: {
  label?: string;
  value?: string | number | null;
  mono?: boolean;
  asId?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = value == null || String(value).trim() === "" ? "" : String(value);

  async function copy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {label ? (
        <span
          className={
            asId
              ? "shrink-0 text-xs text-slate-500"
              : "shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400"
          }
        >
          {label}
        </span>
      ) : null}
      {asId ? <span className="shrink-0 text-[11px] text-slate-400">id:</span> : null}
      <span
        className={`min-w-0 truncate ${
          asId
            ? "font-mono text-xs text-slate-500"
            : mono
              ? "font-mono text-xs text-slate-700"
              : "text-sm font-medium tabular-nums text-slate-700"
        }`}
      >
        {text || "—"}
      </span>
      {text ? (
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      ) : null}
    </div>
  );
}
