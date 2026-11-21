"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { api, Me } from "@/lib/api";
import { TaskNotifications } from "@/components/task-notifications";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/contacts", label: "Contacts" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/agenda", label: "Agenda" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/tasks", label: "Tasks" },
];

const BOTTOM = [
  { href: "/integrations", label: "Integrations" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/api-docs", label: "API Docs" },
  { href: "/settings", label: "Settings" },
];

const WIDTH_KEY = "crm.sidebar.width";
const COLLAPSED_KEY = "crm.sidebar.collapsed";
const SIDEBAR_DEFAULT = 240;
const SIDEBAR_MAX = 360;
const SIDEBAR_FALLBACK_MIN = 196;
const COLLAPSED_WIDTH = 44;
const MEASURE_LABELS = Array.from(
  new Set([...NAV.map((item) => item.label), ...BOTTOM.map((item) => item.label), "Integraciones", "Campaigns"]),
);

function readStoredWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT;
  try {
    const value = Number(window.localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(value) && value > 0) return value;
  } catch {
    /* ignore */
  }
  return SIDEBAR_DEFAULT;
}

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function persist(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function navClass(active: boolean) {
  return `block truncate whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
    active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-50"
  }`;
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(SIDEBAR_DEFAULT);
  const [minWidth, setMinWidth] = useState(SIDEBAR_FALLBACK_MIN);
  const [prefsReady, setPrefsReady] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(SIDEBAR_DEFAULT);
  const minWidthRef = useRef(minWidth);
  const widthRef = useRef(width);

  minWidthRef.current = minWidth;
  widthRef.current = width;

  const clampWidth = useCallback((value: number, min = minWidthRef.current) => {
    const max = Math.max(SIDEBAR_MAX, min);
    return Math.round(Math.min(max, Math.max(min, value)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<Me>("/auth/me")
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const storedMin = SIDEBAR_FALLBACK_MIN;
    setWidth(clampWidth(readStoredWidth(), storedMin));
    setCollapsed(readStoredCollapsed());
    setPrefsReady(true);
  }, [clampWidth]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    let longest = 0;
    for (const child of Array.from(root.children)) {
      longest = Math.max(longest, (child as HTMLElement).offsetWidth);
    }
    const nextMin = Math.max(SIDEBAR_FALLBACK_MIN, Math.ceil(longest + 32));
    minWidthRef.current = nextMin;
    setMinWidth(nextMin);
    setWidth((current) => clampWidth(current, nextMin));
  }, [clampWidth, me, prefsReady]);

  useEffect(() => {
    if (!prefsReady) return;
    persist(WIDTH_KEY, String(width));
  }, [prefsReady, width]);

  useEffect(() => {
    if (!prefsReady) return;
    persist(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed, prefsReady]);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging.current = true;
      dragStartX.current = event.clientX;
      dragStartW.current = widthRef.current;
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const next = clampWidth(dragStartW.current + (event.clientX - dragStartX.current));
      widthRef.current = next;
      setWidth(next);
    },
    [clampWidth],
  );

  const endResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  if (!me || !prefsReady) {
    return <div className="grid h-screen place-items-center text-slate-500">Cargando…</div>;
  }

  const brand = me.branding?.appName || "CRM";
  const color = me.branding?.primaryColor || "#4f46e5";
  const fullHeight = pathname.startsWith("/pipeline") || pathname.startsWith("/inbox") || pathname.startsWith("/agenda");
  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ ["--app-sidebar-width" as string]: `${sidebarWidth}px` }}
    >
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute left-0 top-0 -z-10 px-3 text-sm font-medium"
        aria-hidden
      >
        {MEASURE_LABELS.map((label) => (
          <div key={label} className="whitespace-nowrap px-3 py-2">
            {label}
          </div>
        ))}
      </div>

      {collapsed ? (
        <aside
          className="fixed inset-y-0 left-0 z-20 flex flex-col items-center border-r border-slate-200 bg-white py-3"
          style={{ width: COLLAPSED_WIDTH }}
        >
          <button
            type="button"
            aria-label="Mostrar menú"
            title="Mostrar menú"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-50"
            onClick={() => setCollapsed(false)}
          >
            <HamburgerIcon />
          </button>
        </aside>
      ) : (
        <aside
          className="fixed inset-y-0 left-0 z-20 flex flex-col border-r border-slate-200 bg-white"
          style={{ width, minWidth }}
        >
          <div className="flex items-start justify-between gap-2 px-4 py-5">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold" style={{ color }}>
                {brand}
              </div>
              <div className="truncate text-xs text-slate-500">{me.organizationName}</div>
            </div>
            <button
              type="button"
              aria-label="Ocultar menú"
              title="Ocultar menú"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
              onClick={() => setCollapsed(true)}
            >
              <CollapseIcon />
            </button>
          </div>
          <nav className="min-w-0 flex-1 space-y-1 overflow-hidden px-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navClass(pathname.startsWith(item.href))}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-3 border-t border-slate-100" />
            {BOTTOM.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navClass(pathname.startsWith(item.href))}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="min-w-0 border-t border-slate-100 px-4 py-4 text-xs text-slate-500">
            <div className="truncate font-medium text-slate-700">{me.name}</div>
            <div className="truncate">
              {me.role} · {me.plan}
            </div>
            <button
              className="mt-2 whitespace-nowrap text-indigo-600"
              onClick={async () => {
                await api("/auth/logout", { method: "POST" });
                router.push("/login");
              }}
            >
              Cerrar sesión
            </button>
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar menú"
            aria-valuenow={width}
            aria-valuemin={minWidth}
            aria-valuemax={Math.max(SIDEBAR_MAX, minWidth)}
            tabIndex={0}
            className="absolute inset-y-0 -right-1 z-10 w-2 cursor-grab touch-none hover:bg-indigo-200/50 active:cursor-grabbing"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") setWidth((current) => clampWidth(current - 16));
              if (event.key === "ArrowRight") setWidth((current) => clampWidth(current + 16));
            }}
          />
        </aside>
      )}

      <main
        className={fullHeight ? "h-screen overflow-hidden" : "p-8"}
        style={{ marginLeft: "var(--app-sidebar-width)" }}
      >
        {children}
      </main>
      <TaskNotifications />
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
    </svg>
  );
}
