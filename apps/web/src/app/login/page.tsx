"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthI18n } from "@/lib/auth-i18n";
import {
  AuthError,
  AuthField,
  AuthFooter,
  AuthLayout,
  AuthPasswordField,
  AuthSubmit,
} from "@/components/auth-layout";

const REMEMBER_KEY = "crm_remember_email";

function LoginForm() {
  const router = useRouter();
  const { t, translateError } = useAuthI18n();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const nextEmail = String(form.get("email") || "");
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: nextEmail,
          password: form.get("password"),
        }),
      });
      if (remember) window.localStorage.setItem(REMEMBER_KEY, nextEmail);
      else window.localStorage.removeItem(REMEMBER_KEY);
      router.push("/dashboard");
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : t.genericError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{t.welcomeBack}</h1>
      <p className="mt-1.5 text-sm leading-snug text-slate-500">{t.welcomeSubtitle}</p>
      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <AuthField
          name="email"
          type="email"
          label={t.email}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthPasswordField
          name="password"
          label={t.password}
          placeholder={t.passwordPlaceholder}
          autoComplete="current-password"
          required
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
            />
            {t.rememberMe}
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            {t.forgotPassword}
          </Link>
        </div>
        <AuthError message={error} />
        <AuthSubmit loading={loading}>{loading ? t.loggingIn : t.logIn}</AuthSubmit>
      </form>
      <AuthFooter prompt={t.noAccount} href="/register" action={t.registerNow} />
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
