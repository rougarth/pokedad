import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { DiscordOAuthService } from "./discord-oauth.service.js";

const STATE_COOKIE = "pokedad_discord_oauth_state";
const callbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional()
});

function dashboardRedirect(status: "success" | "error", reason?: string): string {
  const url = new URL("/alerts", env.WEB_ORIGIN);
  url.searchParams.set("discord", status);
  if (reason) url.searchParams.set("reason", reason);
  return url.toString();
}

export async function registerDiscordRoutes(app: FastifyInstance): Promise<void> {
  const service = () => new DiscordOAuthService(app.prisma);

  app.get("/discord/oauth/start", async (request, reply) => {
    try {
      const result = await service().createAuthorization(request.currentUser!.id);
      reply.setCookie(STATE_COOKIE, result.cookieValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        signed: true,
        path: "/",
        maxAge: 10 * 60
      });
      return reply.redirect(result.authorizationUrl);
    } catch (error) {
      return reply.code(503).send({ error: error instanceof Error ? error.message : "Discord OAuth is not configured." });
    }
  });

  app.get("/discord/oauth/callback", async (request, reply) => {
    const query = callbackSchema.parse(request.query);
    const rawCookie = request.cookies[STATE_COOKIE];
    const unsigned = rawCookie ? request.unsignCookie(rawCookie) : null;
    reply.clearCookie(STATE_COOKIE, { path: "/" });
    const oauth = service();
    if (!unsigned?.valid || !oauth.validateState(unsigned.value, query.state, request.currentUser!.id)) {
      await oauth.logInvalidState(request.currentUser!.id);
      return reply.redirect(dashboardRedirect("error", "invalid_state"));
    }
    if (query.error || !query.code) {
      await oauth.logCallbackDenied(request.currentUser!.id);
      return reply.redirect(dashboardRedirect("error", "authorization_denied"));
    }
    try {
      await oauth.connect(request.currentUser!.id, query.code);
      return reply.redirect(dashboardRedirect("success"));
    } catch {
      return reply.redirect(dashboardRedirect("error", "connection_failed"));
    }
  });

  app.get("/discord/status", async (request) => service().getStatus(request.currentUser!.id));

  app.post("/discord/test", async (request, reply) => {
    try {
      const result = await service().test(request.currentUser!.id);
      const sent = result.deliveries[0]?.status === "SENT";
      return reply.code(sent ? 200 : 422).send(result);
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : "Discord test failed safely." });
    }
  });

  app.post("/discord/disconnect", async (request) => {
    await service().disconnect(request.currentUser!.id);
    return { ok: true, status: await service().getStatus(request.currentUser!.id) };
  });
}
