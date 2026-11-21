import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DEFAULT_PIPELINE_STAGES } from "@crm/shared";
import { PUBLIC_NUMBER_STARTS } from "../../common/public-number";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { randomToken, sha256 } from "../../common/crypto";
import { AuthUser, JwtPayload } from "../../common/types";
import { Response } from "express";
import { MailService } from "../mail/mail.service";
import { buildPasswordResetEmail } from "../mail/password-reset.email";

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
    companyName: string;
  }) {
    const exists = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (exists) throw new BadRequestException("Email already registered");

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash,
        },
      });
      const org = await tx.organization.create({
        data: { name: input.companyName },
      });
      await tx.organizationUser.create({
        data: { organizationId: org.id, userId: created.id, role: "owner" },
      });
      await tx.organizationBranding.create({
        data: { organizationId: org.id, appName: input.companyName },
      });
      const pipeline = await tx.pipeline.create({
        data: { organizationId: org.id, name: "Ventas", isDefault: true },
      });
      await tx.pipelineStage.createMany({
        data: DEFAULT_PIPELINE_STAGES.map((s, index) => ({
          organizationId: org.id,
          pipelineId: pipeline.id,
          publicNumber: PUBLIC_NUMBER_STARTS.stage + index,
          name: s.name,
          slug: s.slug,
          position: s.position,
          color: s.color,
          isWon: "isWon" in s ? !!s.isWon : false,
          isLost: "isLost" in s ? !!s.isLost : false,
        })),
      });
      await tx.organization.update({
        where: { id: org.id },
        data: { stagePublicSeq: PUBLIC_NUMBER_STARTS.stage + DEFAULT_PIPELINE_STAGES.length },
      });
      return { ...created, organizationId: org.id, role: "owner" as const };
    });
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { memberships: true },
    });
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const membership = user.memberships[0];
    if (!membership) throw new UnauthorizedException("No organization");
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organizationId,
      role: membership.role,
    };
  }

  attachCookies(
    res: Response,
    user: { id: string; organizationId: string; role: JwtPayload["role"] },
  ) {
    const access = this.jwt.sign(
      { sub: user.id, orgId: user.organizationId, role: user.role, typ: "access" },
      { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_IN || "15m" },
    );
    const refresh = this.jwt.sign(
      { sub: user.id, orgId: user.organizationId, role: user.role, typ: "refresh" },
      {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      },
    );
    res.cookie("access_token", access, { ...COOKIE, maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refresh, { ...COOKIE, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  socketToken(user: AuthUser) {
    const token = this.jwt.sign(
      { sub: user.id, orgId: user.organizationId, role: user.role, typ: "access" },
      { secret: process.env.JWT_SECRET, expiresIn: "10m" },
    );
    return { token, expiresIn: 600 };
  }

  clearCookies(res: Response) {
    res.clearCookie("access_token", COOKIE);
    res.clearCookie("refresh_token", COOKIE);
  }

  async refresh(token: string) {
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      });
      if (payload.typ !== "refresh") throw new Error("bad");
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async me(userId: string, organizationId: string) {
    const [user, membership, org, branding] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      }),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.organizationBranding.findUnique({ where: { organizationId } }),
    ]);
    if (!user || !membership || !org) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: org.id,
      organizationName: org.name,
      role: membership.role,
      plan: org.plan,
      branding,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          take: 1,
          include: { organization: { include: { branding: true } } },
        },
      },
    });
    if (!user) return;
    const token = randomToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const link = `${process.env.WEB_URL}/reset-password?token=${token}`;
    const org = user.memberships[0]?.organization;
    const appName = org?.branding?.appName || org?.name || "CRM";
    const supportEmail = extractEmail(process.env.SMTP_FROM);
    const message = buildPasswordResetEmail({
      appName,
      primaryColor: org?.branding?.primaryColor || "#4f46e5",
      logoUrl: org?.branding?.logoUrl,
      resetUrl: link,
      supportEmail,
    });
    const isDev = process.env.NODE_ENV !== "production";
    try {
      const result = await this.mail.send({
        to: user.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        fromName: appName,
      });
      if (result === "skipped") {
        this.logger.warn(
          "[password-reset] no mail provider configured (set RESEND_API_KEY or SMTP_HOST)",
        );
        if (isDev) this.logger.log(`[password-reset] ${email} ${link}`);
      } else {
        this.logger.log(`[password-reset] email sent to ${email}`);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`[password-reset] failed to send email: ${detail}`);
      if (isDev) this.logger.log(`[password-reset] ${email} ${link}`);
    }
  }

  async resetPassword(token: string, password: string) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired token");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: await argon2.hash(password) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }
}

function extractEmail(from: string | undefined) {
  const raw = from?.trim();
  if (!raw) return undefined;
  const angled = raw.match(/<([^>]+)>/);
  const value = (angled?.[1] || raw).trim();
  if (!value.includes("@")) return undefined;
  const lower = value.toLowerCase();
  if (lower.endsWith("@localhost") || lower.startsWith("noreply@")) return undefined;
  return value;
}
