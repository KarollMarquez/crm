const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const templates = [
    {
      slug: "follow-up-24h",
      name: "Seguimiento 24h",
      description: "Si un lead no responde en 24 horas, enviar un mensaje.",
      trigger: "lead_created",
      category: "seguimiento",
      steps: [
        { type: "wait", config: { hours: 24 } },
        {
          type: "send_message",
          config: { message: "Hola, ¿sigues interesado? Estoy aquí para ayudarte." },
        },
      ],
    },
    {
      slug: "new-whatsapp-lead",
      name: "Lead desde WhatsApp",
      description: "Crea lead y etiqueta al llegar un contacto nuevo.",
      trigger: "contact_created",
      category: "leads",
      steps: [
        { type: "create_lead", config: { service: "WhatsApp" } },
        { type: "create_task", config: { title: "Contactar lead nuevo" } },
      ],
    },
    {
      slug: "ai-handoff",
      name: "Handoff a humano",
      description: "Cuando el cliente pide un asesor, crea tarea y reabre la conversación.",
      trigger: "new_incoming_message",
      category: "ia",
      steps: [{ type: "handoff", config: {} }],
    },
  ];

  for (const tpl of templates) {
    await prisma.automationTemplate.upsert({
      where: { slug: tpl.slug },
      update: tpl,
      create: tpl,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
