import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { appointmentSchema, appointmentUpdateSchema } from "@crm/shared";
import { AppointmentStatus } from "@prisma/client";
import { AppointmentsService } from "./appointments.service";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("contactId") contactId?: string,
    @Query("status") status?: AppointmentStatus,
  ) {
    return this.appointments.list(user.organizationId, { from, to, contactId, status });
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointments.get(user.organizationId, id);
  }

  @Post()
  @Roles("owner", "admin", "agent")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.appointments.create(user.organizationId, appointmentSchema.parse(body));
  }

  @Patch(":id")
  @Roles("owner", "admin", "agent")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.appointments.update(user.organizationId, id, appointmentUpdateSchema.parse(body));
  }
}
