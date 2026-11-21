import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SupabaseService } from './supabase.service';
import { AuthService } from './common/auth.service';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { AuthModule } from './common/auth.module';
import { AuthController } from './common/auth.controller';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AllExceptionsFilter } from './common/zod.filter';
import { AuthGuard } from './common/auth.guard';
import { RolesGuard } from './common/roles.guard';
import { AuditService } from './common/audit.service';
import { ContactsController } from './modules/contacts/contacts.controller';
import { ContactsService } from './modules/contacts/contacts.service';
import { LeadsController } from './modules/leads/leads.controller';
import { LeadsService } from './modules/leads/leads.service';
import { DealsController } from './modules/deals/deals.controller';
import { DealsService } from './modules/deals/deals.service';
import { PipelinesController } from './modules/pipelines/pipelines.controller';
import { PipelinesService } from './modules/pipelines/pipelines.service';
import { TagsController } from './modules/tags/tags.controller';
import { TagsService } from './modules/tags/tags.service';
import { TasksController } from './modules/tasks/tasks.controller';
import { TasksService } from './modules/tasks/tasks.service';
import { AppointmentsController } from './modules/appointments/appointments.controller';
import { AppointmentsService } from './modules/appointments/appointments.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { DashboardController } from './modules/dashboard/dashboard.controller';
import { DashboardService } from './modules/dashboard/dashboard.service';
import { WebhooksController } from './modules/webhooks/webhooks.controller';
import { InboxController } from './modules/inbox/inbox.controller';
import { SegmentsController } from './modules/segments/segments.controller';
import { SegmentsService } from './modules/segments/segments.service';
import { CampaignsController } from './modules/campaigns/campaigns.controller';
import { CampaignsService } from './modules/campaigns/campaigns.service';
import { CampaignsProcessor } from './modules/campaigns/campaigns.processor';
import { AutomationsController } from './modules/automations/automations.controller';
import { AutomationsService } from './modules/automations/automations.service';
import { AutomationsProcessor } from './modules/automations/automations.processor';
import { AiController } from './modules/ai/ai.controller';
import { AiService } from './modules/ai/ai.service';
import { AiProcessor } from './modules/ai/ai.processor';
import { FormsController } from './modules/forms/forms.controller';
import { FormsService } from './modules/forms/forms.service';
import { OrganizationsController } from './modules/organizations/organizations.controller';
import { OrganizationsService } from './modules/organizations/organizations.service';
import { PublicApiController } from './modules/public-api/public-api.controller';
import { ApiKeysService } from './modules/public-api/api-keys.service';
import { OutboundService } from './modules/integrations/outbound.service';
import { OutboundProcessor } from './modules/integrations/outbound.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    AuthModule,
  ],
  controllers: [
    ContactsController,
    LeadsController,
    DealsController,
    PipelinesController,
    TagsController,
    TasksController,
    AppointmentsController,
    UsersController,
    DashboardController,
    WebhooksController,
    InboxController,
    SegmentsController,
    CampaignsController,
    AutomationsController,
    AiController,
    FormsController,
    OrganizationsController,
    PublicApiController,
    AuthController,
  ],
  providers: [
    AuditService,
    SupabaseService,
    AuthService,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}