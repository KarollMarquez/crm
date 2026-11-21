"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "@/lib/api";
import { apiOrigin, playNotificationSound } from "@/lib/notify";

type NotificationPayload = {
  type?: string;
  title?: string;
  body?: string;
  taskId?: string;
  sound?: boolean;
  createdAt?: string;
};

type ToastItem = {
  id: string;
  title: string;
  body: string;
};

export function TaskNotifications() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;
    let refreshTimer: number | undefined;

    async function connect() {
      try {
        const { token } = await api<{ token: string }>("/auth/socket-token");
        if (cancelled) return;

        socket?.disconnect();
        socket = io(apiOrigin(), {
          withCredentials: true,
          transports: ["websocket", "polling"],
          auth: { token },
        });

        socket.on("notification", (payload: NotificationPayload) => {
          if (payload?.type && payload.type !== "task.created") return;
          const dedupeKey = payload.taskId || `${payload.title}-${payload.body}-${payload.createdAt}`;
          if (seenRef.current.has(dedupeKey)) return;
          seenRef.current.add(dedupeKey);
          window.setTimeout(() => seenRef.current.delete(dedupeKey), 15000);

          const id = `${dedupeKey}-${Date.now()}`;
          setToasts((current) =>
            [
              {
                id,
                title: payload.title || "Nueva tarea",
                body: payload.body || "Se creó una tarea",
              },
              ...current,
            ].slice(0, 4),
          );
          if (payload.sound !== false) playNotificationSound();
        });

        refreshTimer = window.setTimeout(() => {
          void connect();
        }, 8 * 60 * 1000);
      } catch {
        refreshTimer = window.setTimeout(() => {
          void connect();
        }, 15000);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      socket?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const latest = toasts[0];
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== latest.id));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">{toast.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{toast.body}</p>
            <a
              href="/tasks"
              className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              Ver tareas
            </a>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="text-slate-400 hover:text-slate-700"
            onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
