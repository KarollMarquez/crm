import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import {
  contactSchema,
  appointmentSchema,
  appointmentUpdateSchema,
  customFieldSchema,
  dealSchema,
  leadUpdateSchema,
  noteSchema,
  pipelineStageCreateSchema,
  pipelineStageUpdateSchema,
  sendMessageSchema,
  tagSchema,
  taskSchema,
} from "@crm/shared";
import { Public } from "../../common/decorators";
import { ApiKeysService } from "./api-keys.service";
import { ContactsService } from "../contacts/contacts.service";
import { DealsService } from "../deals/deals.service";
import { TagsService } from "../tags/tags.service";
import { ChatwootService } from "../chatwoot/chatwoot.service";
import { AutomationsService } from "../automations/automations.service";
import { LeadsService } from "../leads/leads.service";
import { PipelinesService } from "../pipelines/pipelines.service";
import { AppointmentsService } from "../appointments/appointments.service";
import { TasksService } from "../tasks/tasks.service";
import { TaskStatus } from "@prisma/client";

@Controller("v1")
@Public()
export class PublicApiController {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly contacts: ContactsService,
    private readonly deals: DealsService,
    private readonly tags: TagsService,
    private readonly chatwoot: ChatwootService,
    private readonly automations: AutomationsService,
    private readonly leads: LeadsService,
    private readonly pipelines: PipelinesService,
    private readonly appointments: AppointmentsService,
    private readonly tasks: TasksService,
  ) {}

  private async auth(header?: string, scope?: string) {
    const raw = header?.startsWith("Bearer ") ? header.slice(7) : header;
    const key = await this.keys.resolve(raw);
    if (scope && !key.scopes.includes(scope)) {
      throw new UnauthorizedException("Missing scope");
    }
    return key;
  }

  @Get("contacts")
  async contactsList(
    @Headers("authorization") auth?: string,
    @Query("email") email?: string,
    @Query("chatwootContactId") chatwootContactId?: string,
    @Query("q") q?: string,
  ) {
    const key = await this.auth(auth, "contacts.read");
    return this.contacts.list(key.organizationId, { email, chatwootContactId, q });
  }

  @Get("contacts/:id")
  async contactGet(@Headers("authorization") auth: string, @Param("id") id: string) {
    const key = await this.auth(auth, "contacts.read");
    return this.contacts.get(key.organizationId, id);
  }

  @Post("contacts")
  async contactsCreate(@Headers("authorization") auth: string, @Body() body: unknown) {
    const key = await this.auth(auth, "contacts.write");
    return this.contacts.create(key.organizationId, contactSchema.parse(body));
  }

  @Patch("contacts/:id")
  async contactsPatch(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "contacts.write");
    return this.contacts.update(key.organizationId, id, contactSchema.partial().parse(body));
  }

  @Delete("contacts/:id")
  async contactsDelete(@Headers("authorization") auth: string, @Param("id") id: string) {
    const key = await this.auth(auth, "contacts.write");
    return this.contacts.delete(key.organizationId, id);
  }

  @Post("contacts/:id/tags")
  async contactAddTag(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "tags.write");
    const input = tagSchema.parse(body);
    return this.contacts.addTagByName(key.organizationId, id, input.name);
  }

  @Delete("contacts/:id/tags/:tagId")
  async contactRemoveTag(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Param("tagId") tagId: string,
  ) {
    const key = await this.auth(auth, "tags.write");
    return this.contacts.removeTag(key.organizationId, id, tagId);
  }

  @Post("contacts/:id/notes")
  async contactAddNote(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "contacts.write");
    const input = noteSchema.parse(body);
    return this.contacts.addNote(key.organizationId, id, input.body);
  }

  @Post("contacts/:id/fields")
  async contactSetField(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "contacts.write");
    const input = customFieldSchema.parse(body);
    return this.contacts.setField(key.organizationId, id, input.key, input.value);
  }

  @Get("leads")
  async leadsList(@Headers("authorization") auth?: string, @Query("contactId") contactId?: string) {
    const key = await this.auth(auth, "leads.read");
    return this.leads.list(key.organizationId, { contactId });
  }

  @Get("leads/:id")
  async leadGet(@Headers("authorization") auth: string, @Param("id") id: string) {
    const key = await this.auth(auth, "leads.read");
    return this.leads.get(key.organizationId, id);
  }

  @Patch("leads/:id")
  async leadsPatch(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "leads.write");
    return this.leads.update(key.organizationId, id, leadUpdateSchema.parse(body));
  }

  @Delete("leads/:id")
  async leadsDelete(@Headers("authorization") auth: string, @Param("id") id: string) {
    const key = await this.auth(auth, "leads.write");
    return this.leads.delete(key.organizationId, id);
  }

  @Post("leads/:id/fields")
  async leadSetField(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "leads.write");
    const input = customFieldSchema.parse(body);
    return this.leads.setField(key.organizationId, id, input.key, input.value);
  }

  @Get("pipelines")
  async pipelinesList(@Headers("authorization") auth?: string) {
    const key = await this.auth(auth, "leads.read");
    return this.pipelines.list(key.organizationId);
  }

  @Post("stages")
  async stagesCreate(@Headers("authorization") auth: string, @Body() body: unknown) {
    const key = await this.auth(auth, "leads.write");
    const input = pipelineStageCreateSchema.parse(body);
    const pipeline = input.pipelineId
      ? await this.pipelines.assertPipeline(key.organizationId, input.pipelineId)
      : ((await this.pipelines.defaultPipeline(key.organizationId)) ??
        (await this.pipelines.list(key.organizationId))[0]);
    if (!pipeline) throw new NotFoundException("Pipeline not found");
    return this.pipelines.addStage(key.organizationId, pipeline.id, {
      name: input.name,
      color: input.color,
    });
  }

  @Patch("stages/:id")
  async stagesPatch(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "leads.write");
    return this.pipelines.updateStage(
      key.organizationId,
      id,
      pipelineStageUpdateSchema.parse(body),
    );
  }

  @Delete("stages/:id")
  async stagesDelete(@Headers("authorization") auth: string, @Param("id") id: string) {
    const key = await this.auth(auth, "leads.write");
    return this.pipelines.deleteStage(key.organizationId, id);
  }

  @Get("deals")
  async dealsList(@Headers("authorization") auth?: string) {
    const key = await this.auth(auth, "deals.read");
    return this.deals.board(key.organizationId);
  }

  @Post("deals")
  async dealsCreate(@Headers("authorization") auth: string, @Body() body: unknown) {
    const key = await this.auth(auth, "deals.write");
    return this.deals.create(key.organizationId, dealSchema.parse(body));
  }

  @Patch("deals/:id")
  async dealsPatch(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "deals.write");
    const parsed = dealSchema.partial().parse(body);
    if (parsed.stageId) return this.deals.move(key.organizationId, id, parsed.stageId);
    return this.deals.update(key.organizationId, id, parsed);
  }

  @Get("tags")
  async tagsList(@Headers("authorization") auth?: string) {
    const key = await this.auth(auth, "tags.read");
    return this.tags.list(key.organizationId);
  }

  @Post("tags")
  async tagsCreate(@Headers("authorization") auth: string, @Body() body: unknown) {
    const key = await this.auth(auth, "tags.write");
    const input = tagSchema.parse(body);
    return this.tags.create(key.organizationId, input.name, input.color);
  }

  @Get("conversations/:id")
  async conversation(@Headers("authorization") auth: string, @Param("id") id: string) {
    const key = await this.auth(auth, "messages.read");
    return this.chatwoot.getMessages(key.organizationId, Number(id));
  }

  @Post("messages")
  async messages(
    @Headers("authorization") auth: string,
    @Body() body: { conversationId: number; content: string },
  ) {
    const key = await this.auth(auth, "messages.write");
    const content = sendMessageSchema.parse({ content: body.content }).content;
    return this.chatwoot.sendMessage(key.organizationId, body.conversationId, content);
  }

  @Post("automations")
  async automationsCreate(
    @Headers("authorization") auth: string,
    @Body()
    body: {
      name: string;
      trigger: string;
      steps?: { type: string; config?: Record<string, unknown> }[];
    },
  ) {
    const key = await this.auth(auth, "automations.write");
    return this.automations.create(key.organizationId, body);
  }

  @Get("appointments")
  async appointmentsList(
    @Headers("authorization") auth?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("contactId") contactId?: string,
  ) {
    const key = await this.auth(auth, "appointments.read");
    return this.appointments.list(key.organizationId, { from, to, contactId });
  }

  @Get("appointments/:id")
  async appointmentGet(@Headers("authorization") auth: string, @Param("id") id: string) {
    const key = await this.auth(auth, "appointments.read");
    return this.appointments.get(key.organizationId, id);
  }

  @Post("appointments")
  async appointmentsCreate(@Headers("authorization") auth: string, @Body() body: unknown) {
    const key = await this.auth(auth, "appointments.write");
    return this.appointments.create(key.organizationId, appointmentSchema.parse(body));
  }

  @Patch("appointments/:id")
  async appointmentsPatch(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "appointments.write");
    return this.appointments.update(key.organizationId, id, appointmentUpdateSchema.parse(body));
  }

  @Get("tasks")
  async tasksList(
    @Headers("authorization") auth?: string,
    @Query("status") status?: TaskStatus,
  ) {
    const key = await this.auth(auth, "tasks.read");
    return this.tasks.list(key.organizationId, status);
  }

  @Get("tasks/:id")
  async taskGet(@Headers("authorization") auth: string, @Param("id") id: string) {
    const key = await this.auth(auth, "tasks.read");
    return this.tasks.get(key.organizationId, id);
  }

  @Post("tasks")
  async tasksCreate(@Headers("authorization") auth: string, @Body() body: unknown) {
    const key = await this.auth(auth, "tasks.write");
    return this.tasks.create(key.organizationId, taskSchema.parse(body));
  }

  @Patch("tasks/:id")
  async tasksPatch(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const key = await this.auth(auth, "tasks.write");
    return this.tasks.update(key.organizationId, id, taskSchema.partial().parse(body));
  }
}
