import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  companyName: z.string().min(1).max(160),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export const contactSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  source: z.string().max(80).optional(),
  ownerId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

export const leadSchema = z.object({
  contactId: z.string().min(1),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  source: z.string().max(80).optional(),
  service: z.string().max(160).optional(),
  value: z.coerce.number().nonnegative().optional(),
  ownerId: z.string().optional(),
  stageId: z.string().optional(),
  pipelineId: z.string().optional(),
});

export const leadUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  source: z.string().max(80).optional().nullable(),
  service: z.string().max(160).optional().nullable(),
  value: z.coerce.number().nonnegative().optional(),
  ownerId: z.string().optional().nullable(),
  stageId: z.string().optional(),
  stage: z.union([z.string().min(1).max(80), z.number().int().positive()]).optional(),
});

export const noteSchema = z.object({
  body: z.string().min(1).max(8000),
});

export const customFieldSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.string().max(2000),
});

export const dealSchema = z.object({
  contactId: z.string().min(1),
  pipelineId: z.string(),
  stageId: z.string(),
  title: z.string().min(1).max(160).optional(),
  value: z.number().nonnegative().optional(),
  ownerId: z.string().optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  leadId: z.string().optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1).max(200),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().max(20).optional(),
});

export const pipelineStageCreateSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().max(20).optional(),
  pipelineId: z.string().optional(),
});

export const pipelineStageUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().max(20).optional(),
  position: z.number().int().nonnegative().optional(),
});

export const chatwootConnectSchema = z.object({
  baseUrl: z.string().url(),
  accountId: z.string().min(1),
  apiAccessToken: z.string().min(8),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(8000),
  private: z.boolean().optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["owner", "admin", "agent", "viewer"]),
  password: z.string().min(8).max(128).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(["owner", "admin", "agent", "viewer"]).optional(),
});

export const apiKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.string()).min(1),
});

export const campaignSchema = z.object({
  name: z.string().min(1).max(160),
  segmentId: z.string().optional().nullable(),
  inboxId: z.string().optional().nullable(),
  templateName: z.string().optional(),
  message: z.string().min(1),
  status: z.enum(["draft", "scheduled", "running", "completed", "failed"]).optional(),
});

export const aiAgentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  goal: z.string().max(500).optional(),
  systemPrompt: z.string().min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  active: z.boolean().optional(),
  inboxIds: z.array(z.string()).optional(),
});

export const formSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
  fields: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  createDeal: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const publicFormSubmitSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  service: z.string().optional(),
  message: z.string().optional(),
});

const flexibleDatetime = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Fecha u hora inválida");

export const appointmentSchema = z.object({
  name: z.string().min(1).max(160),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  startsAt: flexibleDatetime,
  endsAt: flexibleDatetime.optional(),
  title: z.string().max(160).optional().or(z.literal("")),
  notes: z.string().max(4000).optional().or(z.literal("")),
  source: z.string().max(80).optional(),
});

export const appointmentUpdateSchema = z.object({
  startsAt: flexibleDatetime.optional(),
  endsAt: flexibleDatetime.optional(),
  title: z.string().max(160).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  status: z.enum(["scheduled", "cancelled", "completed", "no_show"]).optional(),
});
