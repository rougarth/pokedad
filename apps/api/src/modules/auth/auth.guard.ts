import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { SESSION_COOKIE_NAME, AuthService, type PublicUser } from "./auth.service.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: PublicUser;
  }
}

const publicPaths = new Set([
  "/health",
  "/auth/login",
  "/api/v1/price/evaluate"
]);

function isPublicPath(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return publicPaths.has(path) || path.startsWith("/v1/helper");
}

export async function registerAuthGuard(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicPath(request.url)) {
      return;
    }

    const rawCookie = request.cookies[SESSION_COOKIE_NAME];
    if (!rawCookie) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const unsigned = request.unsignCookie(rawCookie);
    if (!unsigned.valid || !unsigned.value) {
      return reply.code(401).send({ error: "Invalid session" });
    }

    const user = await new AuthService(app.prisma).getUser(unsigned.value);
    if (!user) {
      return reply.code(401).send({ error: "Invalid session user" });
    }

    request.currentUser = user;
  });
}
