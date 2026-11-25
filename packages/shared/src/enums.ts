export const OrganizationRole = {
  OWNER: "owner",
  ADMIN: "admin",
  AGENT: "agent",
  VIEWER: "viewer",
} as const;

export type OrganizationRole =
  (typeof OrganizationRole)[keyof typeof OrganizationRole];

export const LeadStatus = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  CONVERTED: "converted",
  LOST: "lost",
} as const;

export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const TaskStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const CampaignStatus = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const CampaignRecipientStatus = {
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  REPLIED: "replied",
  FAILED: "failed",
} as const;

export type CampaignRecipientStatus =
  (typeof CampaignRecipientStatus)[keyof typeof CampaignRecipientStatus];

export const AutomationStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
} as const;

export type AutomationStatus =
  (typeof AutomationStatus)[keyof typeof AutomationStatus];

export const AutomationTrigger = {
  CONTACT_CREATED: "contact_created",
  CONTACT_UPDATED: "contact_updated",
  TAG_ADDED: "tag_added",
  TAG_REMOVED: "tag_removed",
  LEAD_CREATED: "lead_created",
  DEAL_CREATED: "deal_created",
  DEAL_STAGE_CHANGED: "deal_stage_changed",
  TASK_COMPLETED: "task_completed",
  NEW_CONVERSATION: "new_conversation",
  NEW_INCOMING_MESSAGE: "new_incoming_message",
  CONVERSATION_ASSIGNED: "conversation_assigned",
  CONVERSATION_RESOLVED: "conversation_resolved",
  CONVERSATION_REOPENED: "conversation_reopened",
  TIME_DELAY: "time_delay",
  WEBHOOK_RECEIVED: "webhook_received",
} as const;

export type AutomationTrigger =
  (typeof AutomationTrigger)[keyof typeof AutomationTrigger];

export const AutomationActionType = {
  CREATE_CONTACT: "create_contact",
  UPDATE_CONTACT: "update_contact",
  ADD_TAG: "add_tag",
  REMOVE_TAG: "remove_tag",
  CREATE_LEAD: "create_lead",
  CREATE_DEAL: "create_deal",
  CHANGE_STAGE: "change_stage",
  ASSIGN_OWNER: "assign_owner",
  CREATE_TASK: "create_task",
  SEND_MESSAGE: "send_message",
  RUN_AI_AGENT: "run_ai_agent",
  WAIT: "wait",
  CONDITION: "condition",
  WEBHOOK: "webhook",
  HANDOFF: "handoff",
} as const;

export type AutomationActionType =
  (typeof AutomationActionType)[keyof typeof AutomationActionType];

export const ApiKeyScope = {
  CONTACTS_READ: "contacts.read",
  CONTACTS_WRITE: "contacts.write",
  LEADS_READ: "leads.read",
  LEADS_WRITE: "leads.write",
  DEALS_READ: "deals.read",
  DEALS_WRITE: "deals.write",
  MESSAGES_READ: "messages.read",
  MESSAGES_WRITE: "messages.write",
  CAMPAIGNS_READ: "campaigns.read",
  CAMPAIGNS_WRITE: "campaigns.write",
  TAGS_READ: "tags.read",
  TAGS_WRITE: "tags.write",
  TASKS_READ: "tasks.read",
  TASKS_WRITE: "tasks.write",
  AUTOMATIONS_WRITE: "automations.write",
  APPOINTMENTS_READ: "appointments.read",
  APPOINTMENTS_WRITE: "appointments.write",
} as const;

export type ApiKeyScope = (typeof ApiKeyScope)[keyof typeof ApiKeyScope];

export const Plan = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
} as const;

export type Plan = (typeof Plan)[keyof typeof Plan];

export const OutboundWebhookEvent = {
  CONTACT_CREATED: "contact.created",
  CONTACT_UPDATED: "contact.updated",
  LEAD_CREATED: "lead.created",
  LEAD_STAGE_CHANGED: "lead.stage_changed",
  LEAD_DELETED: "lead.deleted",
  DEAL_CREATED: "deal.created",
  DEAL_STAGE_CHANGED: "deal.stage_changed",
  CONVERSATION_CREATED: "conversation.created",
  MESSAGE_RECEIVED: "message.received",
  CAMPAIGN_COMPLETED: "campaign.completed",
  APPOINTMENT_CREATED: "appointment.created",
  APPOINTMENT_UPDATED: "appointment.updated",
  TASK_CREATED: "task.created",
} as const;

export type OutboundWebhookEvent =
  (typeof OutboundWebhookEvent)[keyof typeof OutboundWebhookEvent];

export const AppointmentStatus = {
  SCHEDULED: "scheduled",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
} as const;

export type AppointmentStatus =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const DEFAULT_PIPELINE_STAGES = [
  { name: "Nuevo", slug: "nuevo", position: 0, color: "#64748b" },
  { name: "Contactado", slug: "contactado", position: 1, color: "#3b82f6" },
  { name: "Interesado", slug: "interesado", position: 2, color: "#8b5cf6" },
  { name: "Cita agendada", slug: "cita_agendada", position: 3, color: "#f59e0b" },
  { name: "Ganado", slug: "ganado", position: 4, color: "#22c55e", isWon: true },
  { name: "Perdido", slug: "perdido", position: 5, color: "#ef4444", isLost: true },
] as const;
