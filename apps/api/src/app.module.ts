import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// Core
import { SupabaseModule } from './supabase.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';

// Auth
import { AuthService } from './common/auth.service';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { AuthModule } from './common/auth.module';
import { AuthController } from './common/auth.controller';
import { AuthGuard } from './common/auth.guard';
import { RolesGuard } from './common/roles.guard';
import { AuditService } from './common/audit.service';
import { AllExceptionsFilter } from './common/zod.filter';

// Contacts
import { ContactsController } from './modules/contacts/contacts.controller';
import { ContactsService } from './modules/contacts/contacts.service';

// Leads
import { LeadsController } from './modules/leads/leads.controller';
import { LeadsService } from './modules/leads/leads.service';

// Deals
import { DealsController } from './modules/deals/deals.controller';
import { DealsService } from './modules/deals/deals.service';

// Pipelines
import { PipelinesController } from './modules/pipelines/pipelines.controller';
import { PipelinesService } from './modules/pipelines/pipelines.service';

// Tags
import { TagsController } from './modules/tags/tags.controller';
import { TagsService } from './modules/tags/tags.service';

// Tasks
import { TasksController } from './modules/tasks/tasks.controller';
import { TasksService } from './modules/tasks/tasks.service';

// Appointments
import { AppointmentsController } from './modules/appointments/appointments.controller';
import { AppointmentsService } from './modules/appointments/appointments.service';

// Users
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';

// Dashboard
import { DashboardController } from './modules/dashboard/dashboard.controller';
import { DashboardService } from './modules/dashboard/dashboard.service';

// Segments
import { SegmentsController } from './modules/segments/segments.controller';
import { SegmentsService } from './modules/segments/segments.service';

// Campaigns
import { CampaignsController } from './modules/campaigns/campaigns.controller';
import { CampaignsService } from './modules/campaigns/campaigns.service';
import { CampaignsProcessor } from './modules/campaigns/campaigns.processor';

// Automations
import { AutomationsController } from './modules/automations/automations.controller';
import { AutomationsService } from './modules/automations/automations.service';
import { AutomationsProcessor } from './modules/automations/automations.processor';

// AI
import { AiController } from './modules/ai/ai.controller';
import { AiService } from './modules/ai/ai.service';
import { AiProcessor } from './modules/ai/ai.processor';

// Forms
import { FormsController } from './modules/forms/forms.controller';
import { FormsService } from './modules/forms/forms.service';

// Organizations
import { OrganizationsController } from './modules/organizations/organizations.controller';
import { OrganizationsService } from './modules/organizations/organizations.service';

// Public API
import { PublicApiController } from './modules/public-api/public-api.controller';
import { ApiKeysService } from './modules/public-api/api-keys.service';

// Integrations (outbound webhooks)
import { OutboundService } from './modules/integrations/outbound.service';
import { OutboundProcessor } from './modules/integrations/outbound.processor';

// WhatsApp (Meta Cloud API — inbox directo, sin Chatwoot)
import { WhatsAppController } from './whatsapp/whatsapp.controller';
import { WhatsAppService } from './whatsapp/whatsapp.service';

// TODO: Chatwoot desactivado. Reemplazar ChatwootService por InboxService propio.
// import { ChatwootController } from './modules/chatwoot/chatwoot.controller';
// import { ChatwootService } from './modules/chatwoot/chatwoot.service';
// import { ChatwootProcessor } from './modules/chatwoot/chatwoot.processor';
// import { InboxController } from './modules/inbox/inbox.controller';
// import { WebhooksController } from './modules/webhooks/webhooks.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    SupabaseModule,
    PrismaModule,
    QueueModule,
    RealtimeModule,
    AuthModule,
  ],
  controllers: [
    // Auth
    AuthController,
    // CRM core
    ContactsController,
    LeadsController,
    DealsController,
    PipelinesController,
    TagsController,
    TasksController,
    AppointmentsController,
    UsersController,
    DashboardController,
    // Segments & Campaigns
    SegmentsController,
    CampaignsController,
    // Automations
    AutomationsController,
    // AI
    AiController,
    // Forms
    FormsController,
    // Organizations
    OrganizationsController,
    // Public API
    PublicApiController,
    // WhatsApp
    WhatsAppController,
  ],
  providers: [
    // Global filter
    AllExceptionsFilter,
    // Guards
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Core services
    AuditService,
    AuthService,
    // CRM services
    ContactsService,
    LeadsService,
    DealsService,
    PipelinesService,
    TagsService,
    TasksService,
    AppointmentsService,
    UsersService,
    DashboardService,
    // Segments & Campaigns
    SegmentsService,
    CampaignsService,
    CampaignsProcessor,
    // Automations
    AutomationsService,
    AutomationsProcessor,
    // AI
    AiService,
    AiProcessor,
    // Forms
    FormsService,
    // Organizations
    OrganizationsService,
    // Public API
    ApiKeysService,
    // Outbound webhooks
    OutboundService,
    OutboundProcessor,
    // WhatsApp
    WhatsAppService,
  ],
})
export class AppModule {}
