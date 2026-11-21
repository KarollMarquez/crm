"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { useAuthI18n } from "@/lib/auth-i18n";
import {
  AuthError,
  AuthField,
  AuthFooter,
  AuthLayout,
  AuthSubmit,
} from "@/components/auth-layout";

function ForgotForm() {
  const { t, translateError } = useAuthI18n();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email") }),
      });
      setDone(true);
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : t.genericError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{t.forgotTitle}</h1>
      <p className="mt-1.5 text-sm leading-snug text-slate-500">{t.forgotSubtitle}</p>
      {done ? (
        <p className="mt-5 text-sm leading-snug text-slate-600">{t.forgotDone}</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
          <AuthField
            name="email"
            type="email"
            label={t.email}
            placeholder={t.emailPlaceholder}
            autoComplete="email"
            required
          />
          <AuthError message={error} />
          <AuthSubmit loading={loading}>{loading ? t.sending : t.sendLink}</AuthSubmit>
        </form>
      )}
      <AuthFooter href="/login" action={t.backToLogin} />
    </>
  );
}

export default function ForgotPage() {
  return (
    <AuthLayout>
      <ForgotForm />
    </AuthLayout>
  );
}
