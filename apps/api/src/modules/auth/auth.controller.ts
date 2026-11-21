import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@crm/shared";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "../../common/decorators";
import { AuthUser } from "../../common/types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = registerSchema.parse(body);
    const user = await this.auth.register(input);
    this.auth.attachCookies(res, user);
    return { id: user.id, organizationId: user.organizationId, role: user.role };
  }

  @Public()
  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = loginSchema.parse(body);
    const user = await this.auth.login(input.email, input.password);
    this.auth.attachCookies(res, user);
    return user;
  }

  @Post("logout")
  @Public()
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearCookies(res);
    return { ok: true };
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token;
    const payload = await this.auth.refresh(token);
    this.auth.attachCookies(res, {
      id: payload.sub,
      organizationId: payload.orgId,
      role: payload.role,
    });
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id, user.organizationId);
  }

  @Get("socket-token")
  socketToken(@CurrentUser() user: AuthUser) {
    return this.auth.socketToken(user);
  }

  @Public()
  @Post("forgot-password")
  async forgot(@Body() body: unknown) {
    const input = forgotPasswordSchema.parse(body);
    await this.auth.forgotPassword(input.email);
    return { ok: true };
  }

  @Public()
  @Post("reset-password")
  async reset(@Body() body: unknown) {
    const input = resetPasswordSchema.parse(body);
    await this.auth.resetPassword(input.token, input.password);
    return { ok: true };
  }
}
