"use client";

import { Suspense } from "react";
import { InboxView } from "@/components/inbox-view";

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="grid h-full place-items-center text-slate-400">Cargando inbox…</div>}>
      <InboxView />
    </Suspense>
  );
}
