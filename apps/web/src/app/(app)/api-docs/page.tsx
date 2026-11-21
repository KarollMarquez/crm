"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://127.0.0.1:3001";

type Field = { name: string; required?: boolean; note: string };

type MethodDoc = {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  summary: string;
  fields?: Field[];
  example?: Record<string, unknown>;
};

type Section = { id: string; title: string; intro: string; methods: MethodDoc[] };

const SECTIONS: Section[] = [
  {
    id: "contactos",
    title: "Contactos",
    intro: "Las personas de tu CRM. Cada una tiene un número corto (1000, 1042…).",
    methods: [
      {
        id: "list-contacts",
        method: "GET",
        path: "/contacts?chatwootContactId=42&email=ana@correo.com&q=Ana",
        title: "Buscar contactos",
        summary: "Lista contactos. Puedes filtrar por email o por el ID de Chatwoot.",
        fields: [
          { name: "chatwootContactId", note: "ID del contacto en Chatwoot" },
          { name: "email", note: "Email exacto" },
          { name: "q", note: "Texto libre: nombre, email o teléfono" },
        ],
        example: { chatwootContactId: 42, email: "ana@correo.com", q: "Ana" },
      },
      {
        id: "get-contact",
        method: "GET",
        path: "/contacts/1000",
        title: "Ver un contacto",
        summary: "Trae el contacto, sus etiquetas, notas, datos extra y leads.",
        fields: [{ name: "id", required: true, note: "Número corto, p. ej. 1000" }],
      },
      {
        id: "create-contact",
        method: "POST",
        path: "/contacts",
        title: "Crear un contacto",
        summary: "Crea el contacto y un lead en la primera etapa del embudo.",
        fields: [
          { name: "name", required: true, note: "Nombre" },
          { name: "email", note: "Email" },
          { name: "phone", note: "Teléfono" },
          { name: "source", note: "Origen, p. ej. web" },
        ],
        example: {
          name: "Ana Pérez",
          email: "ana@correo.com",
          phone: "+573001112233",
          source: "web",
        },
      },
      {
        id: "update-contact",
        method: "PATCH",
        path: "/contacts/1000",
        title: "Actualizar un contacto",
        summary: "Cambia nombre, email, teléfono u origen. Envía solo lo que quieras cambiar.",
        fields: [
          { name: "name", note: "Nombre" },
          { name: "email", note: "Email" },
          { name: "phone", note: "Teléfono" },
          { name: "source", note: "Origen" },
        ],
        example: {
          name: "Ana Pérez",
          email: "ana@correo.com",
          phone: "+573009998877",
          source: "whatsapp",
        },
      },
      {
        id: "delete-contact",
        method: "DELETE",
        path: "/contacts/1000",
        title: "Eliminar un contacto",
        summary: "Borra el contacto y sus leads. No se puede deshacer.",
        fields: [{ name: "id", required: true, note: "Número corto, p. ej. 1000" }],
      },
      {
        id: "contact-field",
        method: "POST",
        path: "/contacts/1000/fields",
        title: "Guardar un dato extra",
        summary: "Crea o actualiza un campo extra en el contacto (clave + valor).",
        fields: [
          { name: "key", required: true, note: "Nombre del campo, p. ej. servicio" },
          { name: "value", required: true, note: "Valor en texto" },
        ],
        example: { key: "servicio", value: "examen" },
      },
    ],
  },
  {
    id: "leads",
    title: "Leads",
    intro: "Un lead es la oportunidad en el embudo. Muévelo con el número de etapa (3001) o el nombre (contactado).",
    methods: [
      {
        id: "list-leads",
        method: "GET",
        path: "/leads?contactId=1000",
        title: "Ver los leads",
        summary: "Lista los leads. Filtra por contacto si ya lo tienes.",
        fields: [{ name: "contactId", note: "Número del contacto, p. ej. 1000" }],
        example: { contactId: "1000" },
      },
      {
        id: "get-lead",
        method: "GET",
        path: "/leads/2000",
        title: "Ver un lead",
        summary: "Trae el lead, su etapa y los datos extra.",
        fields: [{ name: "id", required: true, note: "Número corto, p. ej. 2000" }],
      },
      {
        id: "move-lead",
        method: "PATCH",
        path: "/leads/2000",
        title: "Mover un lead de etapa",
        summary: "Cambia la etapa. Usa el número que ves en el embudo o el nombre.",
        fields: [
          { name: "stage", required: true, note: "Número (3001) o nombre (contactado)" },
          { name: "status", note: "new, contacted, qualified, converted, lost" },
          { name: "service", note: "Servicio" },
          { name: "value", note: "Valor numérico" },
        ],
        example: {
          stage: 3001,
          status: "contacted",
          service: "Examen visual",
          value: 80000,
        },
      },
      {
        id: "delete-lead",
        method: "DELETE",
        path: "/leads/2000",
        title: "Eliminar un lead",
        summary: "Borra el lead y sus deals. El contacto se mantiene.",
        fields: [{ name: "id", required: true, note: "Número corto, p. ej. 2000" }],
      },
      {
        id: "lead-field",
        method: "POST",
        path: "/leads/2000/fields",
        title: "Guardar un dato extra del lead",
        summary: "Crea o actualiza un campo extra en el lead.",
        fields: [
          { name: "key", required: true, note: "Nombre del campo" },
          { name: "value", required: true, note: "Valor en texto" },
        ],
        example: { key: "motivo", value: "cotizacion" },
      },
    ],
  },
  {
    id: "etapas",
    title: "Etapas",
    intro: "Las columnas del embudo. Cada una tiene un número (3001) y un nombre (contactado).",
    methods: [
      {
        id: "list-pipelines",
        method: "GET",
        path: "/pipelines",
        title: "Ver las etapas",
        summary: "Lista los embudos y sus etapas. El id de cada etapa es el número corto (3001).",
      },
      {
        id: "create-stage",
        method: "POST",
        path: "/stages",
        title: "Agregar una etapa",
        summary: "Crea una etapa al final del embudo.",
        fields: [
          { name: "name", required: true, note: "Nombre, p. ej. Seguimiento" },
          { name: "color", note: "Color hex, p. ej. #64748b" },
        ],
        example: { name: "Seguimiento", color: "#64748b" },
      },
      {
        id: "update-stage",
        method: "PATCH",
        path: "/stages/3001",
        title: "Cambiar una etapa",
        summary: "Cambia nombre, color o posición. El id es el número corto (3001).",
        fields: [
          { name: "name", note: "Nuevo nombre" },
          { name: "color", note: "Color hex" },
          { name: "position", note: "Orden (0, 1, 2…)" },
        ],
        example: { name: "Contactado", color: "#3b82f6", position: 1 },
      },
      {
        id: "delete-stage",
        method: "DELETE",
        path: "/stages/3001",
        title: "Quitar una etapa",
        summary: "Borra la etapa. Los leads pasan a otra del mismo embudo. Debe quedar al menos una.",
        fields: [{ name: "id", required: true, note: "Número corto, p. ej. 3001" }],
      },
    ],
  },
  {
    id: "etiquetas",
    title: "Etiquetas y notas",
    intro: "Marca contactos con etiquetas y deja notas en su historial.",
    methods: [
      {
        id: "list-tags",
        method: "GET",
        path: "/tags",
        title: "Ver las etiquetas",
        summary: "Lista las etiquetas de la organización.",
      },
      {
        id: "create-tag",
        method: "POST",
        path: "/tags",
        title: "Crear una etiqueta",
        summary: "Crea una etiqueta sin asignarla todavía a un contacto.",
        fields: [
          { name: "name", required: true, note: "Nombre, p. ej. Interesado" },
          { name: "color", note: "Color hex" },
        ],
        example: { name: "Interesado", color: "#6366f1" },
      },
      {
        id: "add-tag",
        method: "POST",
        path: "/contacts/1000/tags",
        title: "Poner una etiqueta a un contacto",
        summary: "Si la etiqueta no existe, se crea. Si ya la tiene, no se duplica.",
        fields: [{ name: "name", required: true, note: "Nombre de la etiqueta" }],
        example: { name: "Interesado" },
      },
      {
        id: "remove-tag",
        method: "DELETE",
        path: "/contacts/1000/tags/Interesado",
        title: "Quitar una etiqueta",
        summary: "Puedes usar el nombre (Interesado) o el id que devuelve la lista de etiquetas.",
        fields: [
          { name: "id", required: true, note: "Número del contacto, p. ej. 1000" },
          { name: "tagId", required: true, note: "Nombre o id de la etiqueta" },
        ],
      },
      {
        id: "add-note",
        method: "POST",
        path: "/contacts/1000/notes",
        title: "Añadir una nota",
        summary: "Agrega una nota al historial del contacto.",
        fields: [{ name: "body", required: true, note: "Texto de la nota" }],
        example: { body: "Respondió por WhatsApp" },
      },
    ],
  },
  {
    id: "tareas",
    title: "Tareas",
    intro: "Crea y lista tareas. Al crear una, el CRM notifica en tiempo real (con sonido) a los usuarios conectados.",
    methods: [
      {
        id: "list-tasks",
        method: "GET",
        path: "/tasks?status=pending",
        title: "Listar tareas",
        summary: "Lista las tareas de la organización. Opcional: filtrar por status.",
        fields: [{ name: "status", note: "pending, in_progress o completed" }],
        example: { status: "pending" },
      },
      {
        id: "get-task",
        method: "GET",
        path: "/tasks/clxyz123",
        title: "Ver una tarea",
        summary: "Trae la tarea con contacto y asignado.",
        fields: [{ name: "id", required: true, note: "ID de la tarea" }],
      },
      {
        id: "create-task",
        method: "POST",
        path: "/tasks",
        title: "Crear una tarea",
        summary: "Crea la tarea y dispara notificación + sonido en el CRM.",
        fields: [
          { name: "title", required: true, note: "Título" },
          { name: "contactId", note: "Número corto o id del contacto" },
          { name: "dueAt", note: "Vencimiento (ISO 8601)" },
          { name: "priority", note: "low, medium o high" },
          { name: "status", note: "pending, in_progress o completed" },
        ],
        example: {
          title: "Llamar al paciente",
          contactId: "1000",
          dueAt: "2026-09-22T15:00:00-05:00",
          priority: "high",
          status: "pending",
        },
      },
      {
        id: "update-task",
        method: "PATCH",
        path: "/tasks/clxyz123",
        title: "Actualizar una tarea",
        summary: "Cambia título, estado, prioridad, vencimiento o asignado.",
        fields: [
          { name: "title", note: "Título" },
          { name: "status", note: "pending, in_progress, completed" },
          { name: "priority", note: "low, medium, high" },
          { name: "dueAt", note: "ISO 8601 o null" },
        ],
        example: {
          title: "Llamar al paciente",
          status: "completed",
          priority: "medium",
          dueAt: "2026-09-22T15:00:00-05:00",
        },
      },
    ],
  },
  {
    id: "citas",
    title: "Citas",
    intro: "Agenda, consulta, reagenda o cancela citas. Si el contacto ya existe, se actualiza.",
    methods: [
      {
        id: "list-appointments",
        method: "GET",
        path: "/appointments?from=2026-09-01T00:00:00-05:00&to=2026-09-30T23:59:59-05:00&contactId=1000",
        title: "Ver las citas",
        summary: "Lista citas. Filtra por fechas o por contacto.",
        fields: [
          { name: "from", note: "Inicio del rango (ISO 8601)" },
          { name: "to", note: "Fin del rango (ISO 8601)" },
          { name: "contactId", note: "Número corto o id del contacto" },
        ],
        example: {
          from: "2026-09-01T00:00:00-05:00",
          to: "2026-09-30T23:59:59-05:00",
          contactId: "1000",
        },
      },
      {
        id: "get-appointment",
        method: "GET",
        path: "/appointments/4000",
        title: "Ver una cita",
        summary: "Trae la cita, el paciente y el lead asociado.",
        fields: [{ name: "id", required: true, note: "Número corto, p. ej. 4000" }],
      },
      {
        id: "create-appointment",
        method: "POST",
        path: "/appointments",
        title: "Agendar una cita",
        summary: "Busca o crea el contacto, mueve el lead a Cita agendada y guarda la cita (30 min por defecto).",
        fields: [
          { name: "name", required: true, note: "Nombre del paciente" },
          { name: "phone", note: "Teléfono (sirve para encontrar el contacto)" },
          { name: "email", note: "Email" },
          { name: "startsAt", required: true, note: "Inicio (ISO 8601)" },
          { name: "endsAt", note: "Fin. Si no va, dura 30 minutos" },
          { name: "notes", note: "Notas de la cita" },
          { name: "source", note: "Origen, p. ej. web" },
        ],
        example: {
          name: "Ana Pérez",
          phone: "+573001112233",
          email: "ana@correo.com",
          startsAt: "2026-09-22T15:00:00-05:00",
          endsAt: "2026-09-22T15:30:00-05:00",
          notes: "Examen visual",
          source: "web",
        },
      },
      {
        id: "update-appointment",
        method: "PATCH",
        path: "/appointments/4000",
        title: "Reagendar o cancelar una cita",
        summary:
          "Cambia horario, notas o estado. Si solo envías startsAt, endsAt se ajusta manteniendo la duración. El estado sigue scheduled salvo que lo cambies (p. ej. cancelled). El id va en la URL (número corto).",
        fields: [
          { name: "startsAt", note: "Nuevo inicio (ISO 8601). Reagenda sin cambiar el estado" },
          { name: "endsAt", note: "Nuevo fin. Opcional si solo mueves el inicio" },
          { name: "status", note: "scheduled, cancelled, completed, no_show" },
          { name: "notes", note: "Notas" },
        ],
        example: {
          startsAt: "2026-09-23T10:00:00-05:00",
          endsAt: "2026-09-23T10:30:00-05:00",
          status: "scheduled",
          notes: "Reagendada a la mañana",
        },
      },
    ],
  },
];

const METHOD_COLOR: Record<MethodDoc["method"], string> = {
  GET: "bg-sky-50 text-sky-700 ring-sky-100",
  POST: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  PATCH: "bg-amber-50 text-amber-700 ring-amber-100",
  DELETE: "bg-rose-50 text-rose-700 ring-rose-100",
};

function MethodRow({ doc }: { doc: MethodDoc }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${API_BASE}/api/v1${doc.path}`;
  const exampleText = doc.example ? JSON.stringify(doc.example, null, 2) : "";

  async function copyExample() {
    const payload = exampleText || url;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50"
      >
        <span
          className={`mt-0.5 w-16 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold ring-1 ring-inset ${METHOD_COLOR[doc.method]}`}
        >
          {doc.method}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-900">{doc.title}</span>
          <span className="mt-0.5 block text-sm text-slate-500">{doc.summary}</span>
        </span>
        <span className="mt-1 shrink-0 text-xs text-slate-400">{open ? "Ocultar" : "Ver detalle"}</span>
      </button>
      {open ? (
        <div className="space-y-3 px-4 pb-4 pl-[5.75rem]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-slate-500">
              Método <span className="font-medium text-slate-800">{doc.method}</span>
            </span>
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{url}</code>
          </div>
          {doc.fields?.length ? (
            <ul className="space-y-1 text-sm">
              {doc.fields.map((field) => (
                <li key={field.name} className="flex flex-wrap gap-x-2">
                  <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-700">{field.name}</code>
                  <span className={field.required ? "text-xs font-medium text-rose-600" : "text-xs text-slate-400"}>
                    {field.required ? "requerido" : "opcional"}
                  </span>
                  <span className="text-slate-500">{field.note}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {exampleText ? (
            <div className="overflow-hidden rounded-xl bg-slate-900">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {doc.method === "GET" ? "Ejemplo (query)" : "Ejemplo (body)"}
                </span>
                <button
                  type="button"
                  onClick={copyExample}
                  className="rounded px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <pre className="overflow-x-auto px-3 pb-3 font-mono text-xs leading-relaxed text-slate-100">
                {exampleText}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Documentación"
        subtitle="Qué puedes hacer con una clave: contactos, leads, etapas, etiquetas y citas."
        actions={
          <Link
            href="/api-keys"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            API Keys
          </Link>
        }
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm text-slate-600">
            Todas las peticiones van con{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">Authorization: Bearer crm_…</code>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Dirección: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{API_BASE}/api/v1</code>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Los IDs son números cortos en rangos distintos: contactos <code className="rounded bg-slate-100 px-1 font-mono text-xs">1000+</code>, leads{" "}
            <code className="rounded bg-slate-100 px-1 font-mono text-xs">2000+</code>, etapas{" "}
            <code className="rounded bg-slate-100 px-1 font-mono text-xs">3000+</code>, citas{" "}
            <code className="rounded bg-slate-100 px-1 font-mono text-xs">4000+</code>. Para mover un lead usa{" "}
            <code className="rounded bg-slate-100 px-1 font-mono text-xs">{`{"stage":3001}`}</code> o{" "}
            <code className="rounded bg-slate-100 px-1 font-mono text-xs">{`{"stage":"contactado"}`}</code>.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 px-5 py-3">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              {section.title}
            </a>
          ))}
        </nav>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="mb-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">{section.title}</h2>
          <p className="mb-3 text-sm text-slate-500">{section.intro}</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {section.methods.map((doc) => (
              <MethodRow key={doc.id} doc={doc} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
