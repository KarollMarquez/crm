import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC } from "./decorators";
import { JwtPayload } from "./types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token =
      req.cookies?.access_token ||
      req.headers.authorization?.replace("Bearer ", "");
    if (!token) throw new UnauthorizedException("Missing session");

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      if (payload.typ !== "access") throw new Error("wrong token");
      req.user = {
        id: payload.sub,
        organizationId: payload.orgId,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid session");
    }
  }
}
