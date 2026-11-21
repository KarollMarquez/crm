import {
  ConnectedSocket,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { JwtPayload } from "../common/types";

function cookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_URL || process.env.APP_URL || "http://localhost:3002",
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token =
        cookieValue(client.handshake.headers.cookie, "access_token") ||
        (typeof client.handshake.auth?.token === "string"
          ? client.handshake.auth.token
          : undefined) ||
        (typeof client.handshake.query?.token === "string"
          ? client.handshake.query.token
          : undefined);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      if (payload.typ !== "access" || !payload.orgId) {
        client.disconnect(true);
        return;
      }
      await client.join(`org:${payload.orgId}`);
      client.data.organizationId = payload.orgId;
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
    }
  }

  emitToOrg(organizationId: string, event: string, payload: unknown) {
    this.server?.to(`org:${organizationId}`).emit(event, payload);
  }
}
