import { BadRequestException, Injectable } from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit.service";
import { randomToken } from "../../common/crypto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organizationId: string) {
    return this.prisma.organizationUser.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true, updatedAt: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async invite(
    organizationId: string,
    actorId: string,
    input: { email: string; name: string; role: OrganizationRole; password?: string },
  ) {
    const email = input.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: input.name,
          passwordHash: await argon2.hash(input.password || randomToken(8)),
        },
      });
    }
    const existing = await this.prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (existing) throw new BadRequestException("User already in organization");
    const membership = await this.prisma.organizationUser.create({
      data: { organizationId, userId: user.id, role: input.role },
    });
    await this.audit.log({
      organizationId,
      actorUserId: actorId,
      action: "user.invited",
      entity: "user",
      entityId: user.id,
    });
    return membership;
  }

  async updateRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
    actorId: string,
  ) {
    const result = await this.prisma.organizationUser.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true, updatedAt: true } },
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId: actorId,
      action: "user.role_changed",
      entity: "user",
      entityId: userId,
      metadata: { role },
    });
    return result;
  }

  async update(
    organizationId: string,
    userId: string,
    input: { name?: string; role?: OrganizationRole },
    actorId: string,
  ) {
    const membership = await this.prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new BadRequestException("User not in organization");

    if (input.name?.trim()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { name: input.name.trim() },
      });
      await this.audit.log({
        organizationId,
        actorUserId: actorId,
        action: "user.updated",
        entity: "user",
        entityId: userId,
        metadata: { name: input.name.trim() },
      });
    }

    if (input.role && input.role !== membership.role) {
      return this.updateRole(organizationId, userId, input.role, actorId);
    }

    return this.prisma.organizationUser.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId, userId } },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true, updatedAt: true } },
      },
    });
  }

  async remove(organizationId: string, userId: string, actorId: string) {
    if (userId === actorId) {
      throw new BadRequestException("No puedes quitarte a ti mismo");
    }
    const membership = await this.prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new BadRequestException("User not in organization");
    if (membership.role === "owner") {
      const owners = await this.prisma.organizationUser.count({
        where: { organizationId, role: "owner" },
      });
      if (owners <= 1) {
        throw new BadRequestException("Debe quedar al menos un owner");
      }
    }
    await this.prisma.organizationUser.delete({
      where: { organizationId_userId: { organizationId, userId } },
    });
    await this.audit.log({
      organizationId,
      actorUserId: actorId,
      action: "user.removed",
      entity: "user",
      entityId: userId,
    });
    return { ok: true };
  }
}
