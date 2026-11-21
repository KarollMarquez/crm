"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card } from "@/components/ui";

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<{ name: string } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api<{ name: string }>(`/forms/public/${slug}`).then(setForm).catch(() => setForm(null));
  }, [slug]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await api(`/forms/public/${slug}`, {
      method: "POST",
      body: JSON.stringify({
        name: data.get("name"),
        phone: data.get("phone"),
        email: data.get("email"),
        service: data.get("service"),
        message: data.get("message"),
      }),
    });
    setDone(true);
  }

  if (!form) return <div className="grid min-h-screen place-items-center">Formulario no encontrado</div>;
  if (done) return <div className="grid min-h-screen place-items-center">Gracias, te contactaremos pronto.</div>;

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-md">
        <h1 className="mb-4 text-xl font-semibold">{form.name}</h1>
        <form onSubmit={submit} className="space-y-3">
          <input name="name" placeholder="Nombre" required />
          <input name="phone" placeholder="Teléfono" />
          <input name="email" type="email" placeholder="Email" />
          <input name="service" placeholder="Servicio" />
          <textarea name="message" placeholder="Mensaje" />
          <Button type="submit" className="w-full">
            Enviar
          </Button>
        </form>
      </Card>
    </div>
  );
}
