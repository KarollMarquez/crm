import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.tag.findMany({
      where: { organizationId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: "asc" },
    });
  }

  create(organizationId: string, name: string, color?: string) {
    return this.prisma.tag.create({
      data: { organizationId, name, color: color || "#6366f1" },
    });
  }
}
