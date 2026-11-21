import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit.service";
import { randomToken, sha256 } from "../../common/crypto";

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(organizationId: string, actorId: string, name: string, scopes: string[]) {
    const raw = `crm_${randomToken(24)}`;
    const key = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name,
        scopes,
        keyHash: sha256(raw),
        keyPrefix: raw.slice(0, 10),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId: actorId,
      action: "api_key.created",
      entity: "api_key",
      entityId: key.id,
    });
    return { ...key, secret: raw };
  }

  async revoke(organizationId: string, id: string, actorId: string) {
    const key = await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      organizationId,
      actorUserId: actorId,
      action: "api_key.revoked",
      entity: "api_key",
      entityId: id,
    });
    return key;
  }

  async resolve(raw?: string) {
    if (!raw) throw new UnauthorizedException("Missing API key");
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: sha256(raw) },
    });
    if (!key || key.revokedAt) throw new UnauthorizedException("Invalid API key");
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return key;
  }
}
