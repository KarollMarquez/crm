"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
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

function RegisterForm() {
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
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          companyName: form.get("companyName"),
        }),
      });
      router.push("/dashboard");
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : t.genericError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{t.createAccount}</h1>
      <p className="mt-1.5 text-sm leading-snug text-slate-500">{t.createSubtitle}</p>
      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <AuthField
          name="name"
          label={t.name}
          placeholder={t.namePlaceholder}
          autoComplete="name"
          required
        />
        <AuthField
          name="email"
          type="email"
          label={t.email}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          required
        />
        <AuthPasswordField
          name="password"
          label={t.password}
          placeholder={t.passwordPlaceholder}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <AuthField
          name="companyName"
          label={t.companyName}
          placeholder={t.companyPlaceholder}
          autoComplete="organization"
          required
        />
        <AuthError message={error} />
        <AuthSubmit loading={loading}>{loading ? t.registering : t.register}</AuthSubmit>
      </form>
      <AuthFooter prompt={t.haveAccount} href="/login" action={t.loginNow} />
    </>
  );
}

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
