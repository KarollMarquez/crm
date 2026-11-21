"use client";

import Link from "next/link";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AuthI18nProvider, useAuthI18n, type Lang } from "@/lib/auth-i18n";

function AuthMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <g fill="#4f46e5">
        <circle cx="16" cy="9" r="6.2" />
        <circle cx="16" cy="23" r="6.2" />
        <circle cx="9" cy="16" r="6.2" />
        <circle cx="23" cy="16" r="6.2" />
      </g>
      <circle cx="16" cy="16" r="3.4" fill="#818cf8" />
    </svg>
  );
}

function LangToggle() {
  const { lang, setLang } = useAuthI18n();
  const btn = (code: Lang, label: string) => (
    <button
      type="button"
      onClick={() => setLang(code)}
      className={`rounded-md px-1.5 py-0.5 !text-xs font-semibold tracking-wide ${
        lang === code ? "bg-indigo-50 text-indigo-600" : "bg-transparent text-slate-400 hover:text-slate-600"
      }`}
      aria-pressed={lang === code}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 text-slate-300" aria-label="Language">
      {btn("es", "ES")}
      <span className="text-xs text-slate-300">|</span>
      {btn("en", "EN")}
    </div>
  );
}

function DashboardPreview() {
  const { t } = useAuthI18n();
  const rows = [
    { id: "#18459021", name: "Apple iPad Mini 6th", date: "15 February, 2025", price: "$448", status: "transit" },
    { id: "#18459022", name: "Apple iPhone 13", date: "14 February, 2025", price: "$799", status: "paid" },
    { id: "#18459023", name: "Apple MacBook Air M2", date: "13 February, 2025", price: "$1,199", status: "paid" },
    { id: "#18459024", name: "Apple AirPods 4", date: "12 February, 2025", price: "$179", status: "paid" },
  ];

  return (
    <div className="relative w-full max-w-[520px] origin-left scale-[0.78] xl:max-w-[560px] xl:scale-[0.88] 2xl:scale-100">
      <div className="rounded-xl bg-white p-3 shadow-2xl shadow-indigo-950/20">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-white p-2 ring-1 ring-slate-100">
            <p className="text-[10px] font-medium text-slate-500">{t.totalSales}</p>
            <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">$189,374</p>
            <p className="text-[9px] text-emerald-600">↑ 12% {t.fromLastWeek}</p>
            <svg viewBox="0 0 120 28" className="mt-1 h-4 w-full" aria-hidden="true">
              <path
                d="M0 20 C18 18 22 8 40 12 C58 16 62 6 80 10 C98 14 104 4 120 8"
                fill="none"
                stroke="#818cf8"
                strokeWidth="2"
              />
            </svg>
            <p className="mt-1 text-[10px] font-medium text-slate-500">{t.totalProfit}</p>
            <p className="text-sm font-semibold text-slate-900">$25,684</p>
          </div>
          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-100">
            <p className="text-[10px] font-medium text-slate-500">{t.chartPerformance}</p>
            <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">00:01:30</p>
            <p className="text-[9px] text-slate-400">{t.fromLastMonth}</p>
            <svg viewBox="0 0 140 56" className="mt-1.5 h-9 w-full" aria-hidden="true">
              <defs>
                <linearGradient id="auth-line" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 40 C18 38 28 28 42 30 C58 32 68 18 84 22 C100 26 112 14 140 16 L140 56 L0 56 Z"
                fill="url(#auth-line)"
              />
              <path
                d="M0 40 C18 38 28 28 42 30 C58 32 68 18 84 22 C100 26 112 14 140 16"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-100">
            <div className="flex items-start justify-between">
              <p className="text-[10px] font-medium text-slate-500">{t.salesOverview}</p>
              <span className="rounded-md bg-slate-50 px-1 py-0.5 text-[9px] text-slate-500">{t.weekly}</span>
            </div>
            <div className="mt-2 flex h-14 items-end justify-between gap-1 px-0.5">
              {[40, 62, 48, 78, 55, 88, 36].map((h, i) => (
                <div
                  key={i}
                  className={`w-full rounded-t-md ${i === 5 ? "bg-indigo-500" : "bg-indigo-100"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2.5">
          <p className="mb-1.5 text-[10px] font-semibold text-slate-700">{t.productTransaction}</p>
          <table className="w-full text-left text-[9px] text-slate-600">
            <thead>
              <tr className="text-[8px] uppercase tracking-wide text-slate-400">
                <th className="pb-1 font-medium">ID</th>
                <th className="pb-1 font-medium">{t.productName}</th>
                <th className="pb-1 font-medium">{t.orderDate}</th>
                <th className="pb-1 font-medium">{t.totalPrice}</th>
                <th className="pb-1 font-medium">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-1 text-slate-400">{row.id}</td>
                  <td className="py-1 font-medium text-slate-700">{row.name}</td>
                  <td className="py-1">{row.date}</td>
                  <td className="py-1">{row.price}</td>
                  <td className="py-1">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                        row.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {row.status === "paid" ? t.paid : t.inTransit}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="absolute -right-4 top-6 w-36 rounded-xl bg-white p-2.5 shadow-xl shadow-indigo-950/20 ring-1 ring-slate-100 xl:-right-8 xl:w-40">
        <p className="text-[10px] font-medium text-slate-500">{t.salesCategories}</p>
        <div className="relative mx-auto mt-1.5 h-20 w-20">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="40" fill="none" stroke="#eef2ff" strokeWidth="16" />
            <circle
              cx="60"
              cy="60"
              r="40"
              fill="none"
              stroke="#4f46e5"
              strokeWidth="16"
              strokeDasharray="100 151"
              strokeLinecap="round"
            />
            <circle
              cx="60"
              cy="60"
              r="40"
              fill="none"
              stroke="#818cf8"
              strokeWidth="16"
              strokeDasharray="55 196"
              strokeDashoffset="-108"
              strokeLinecap="round"
            />
            <circle
              cx="60"
              cy="60"
              r="40"
              fill="none"
              stroke="#c7d2fe"
              strokeWidth="16"
              strokeDasharray="40 211"
              strokeDashoffset="-168"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-[8px] text-slate-400">{t.totalSales}</p>
              <p className="text-xs font-semibold text-slate-900">6,248 {t.units}</p>
            </div>
          </div>
        </div>
        <ul className="mt-1.5 space-y-0.5 text-[9px] text-slate-600">
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" /> {t.dropshipping}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> {t.laptops}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-200" /> {t.accessories}
          </li>
        </ul>
      </div>
    </div>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useAuthI18n();

  return (
    <div className="flex h-screen min-h-screen items-center justify-center overflow-hidden bg-[#e8eaef] p-3 sm:p-4 supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:min-h-[100dvh]">
      <div className="mx-auto flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-[1280px] overflow-hidden rounded-3xl bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)] sm:max-h-[calc(100dvh-2rem)]">
        <div className="relative flex min-h-0 w-full flex-col px-5 py-4 sm:px-8 lg:w-[44%] lg:px-10 lg:py-5">
          <div className="flex shrink-0 items-center justify-between">
            <div className="flex items-center gap-2">
              <AuthMark />
              <span className="text-[15px] font-semibold tracking-tight text-slate-900">{t.brand}</span>
            </div>
            <LangToggle />
          </div>
          <div className="flex min-h-0 flex-1 items-center">
            <div className="mx-auto w-full max-w-[380px] py-2">{children}</div>
          </div>
        </div>

        <div className="relative hidden min-h-0 overflow-hidden bg-[#4f46e5] lg:flex lg:w-[56%] lg:flex-col lg:px-8 lg:py-6 xl:px-10 xl:py-7">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -right-16 -top-24 h-[320px] w-[320px] rounded-[72px] border-[28px] border-white/10" />
            <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full border-[22px] border-white/[0.08]" />
            <div className="absolute right-24 top-1/3 h-20 w-20 rotate-12 rounded-3xl bg-white/5" />
            <div className="absolute bottom-1/4 left-16 h-14 w-14 rounded-full bg-indigo-400/20" />
            <div className="absolute right-1/3 bottom-16 h-32 w-32 rotate-45 rounded-[32px] border-8 border-white/[0.07]" />
          </div>
          <div className="relative z-10 max-w-xl shrink-0">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-white xl:text-[28px]">
              {t.marketingHeadline}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-snug text-indigo-100">{t.marketingSub}</p>
          </div>
          <div className="relative z-10 flex min-h-0 flex-1 items-center overflow-hidden pt-4">
            <DashboardPreview />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthI18nProvider>
      <AuthShell>{children}</AuthShell>
    </AuthI18nProvider>
  );
}

export function AuthField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-slate-700">{label}</span>
      <input {...props} className={`h-10 px-3.5 py-2 text-sm ${className}`} />
    </label>
  );
}

export function AuthPasswordField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [show, setShow] = useState(false);
  const { t } = useAuthI18n();
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-slate-700">{label}</span>
      <span className="relative block">
        <input
          {...props}
          type={show ? "text" : "password"}
          className={`h-10 px-3.5 py-2 pr-11 text-sm ${className}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md !bg-transparent !p-1 text-slate-400 hover:text-slate-600"
          aria-label={show ? t.hidePassword : t.showPassword}
        >
          {show ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l18 18" strokeLinecap="round" />
              <path d="M10.6 10.7a2 2 0 002.8 2.8" strokeLinecap="round" />
              <path d="M9.9 5.2A10.5 10.5 0 0121 12c-.6 1.1-1.4 2.1-2.4 3M6.1 6.2C4.3 7.7 2.9 9.7 2 12c1.6 4 5.5 7 10 7 1.5 0 2.9-.3 4.2-.9" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
    </label>
  );
}

export function AuthSubmit({ children, loading }: { children: ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="h-10 w-full !rounded-lg bg-indigo-600 !text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-rose-600">{message}</p>;
}

export function AuthFooter({
  prompt,
  href,
  action,
}: {
  prompt?: string;
  href: string;
  action: string;
}) {
  return (
    <p className="mt-5 text-center text-sm text-slate-500">
      {prompt ? <>{prompt} </> : null}
      <Link href={href} className="font-medium text-indigo-600 hover:text-indigo-500">
        {action}
      </Link>
    </p>
  );
}
