"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { api } from "@/lib/api";
import { useAuthI18n } from "@/lib/auth-i18n";
import {
  AuthError,
  AuthFooter,
  AuthLayout,
  AuthPasswordField,
  AuthSubmit,
} from "@/components/auth-layout";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { t, translateError } = useAuthI18n();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: params.get("token"),
          password: form.get("password"),
        }),
      });
      router.push("/login");
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : t.genericError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{t.resetTitle}</h1>
      <p className="mt-1.5 text-sm leading-snug text-slate-500">{t.resetSubtitle}</p>
      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <AuthPasswordField
          name="password"
          label={t.password}
          placeholder={t.newPasswordPlaceholder}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <AuthError message={error} />
        <AuthSubmit loading={loading}>{loading ? t.saving : t.savePassword}</AuthSubmit>
      </form>
      <AuthFooter href="/login" action={t.backToLogin} />
    </>
  );
}

function ResetFallback() {
  const { t } = useAuthI18n();
  return <p className="text-sm text-slate-500">{t.loading}</p>;
}

export default function ResetPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<ResetFallback />}>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
