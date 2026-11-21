import { OrganizationRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: OrganizationRole;
};

export type JwtPayload = {
  sub: string;
  orgId: string;
  role: OrganizationRole;
  typ: "access" | "refresh";
};
