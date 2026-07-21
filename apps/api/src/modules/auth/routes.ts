import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AuditService } from "../../services/audit.service.js";
import { AuthService, SESSION_COOKIE_NAME } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(8)
});

type LoginAttemptState = {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

const loginAttempts = new Map<string, LoginAttemptState>();
const loginWindowMs = 15 * 60 * 1000;
const loginLockMs = 10 * 60 * 1000;
const maxLoginAttempts = 5;

function getLoginAttemptKey(ip: string, email: string): string {
  return `${ip}:${email.trim().toLowerCase()}`;
}

function getLoginThrottleMs(key: string, now = Date.now()): number {
  const state = loginAttempts.get(key);
  if (!state) {
    return 0;
  }

  if (state.lockedUntil && state.lockedUntil > now) {
    return state.lockedUntil - now;
  }

  if (now - state.firstAttemptAt > loginWindowMs) {
    loginAttempts.delete(key);
  }

  return 0;
}

function recordFailedLogin(key: string, now = Date.now()): void {
  const existing = loginAttempts.get(key);
  const state =
    existing && now - existing.firstAttemptAt <= loginWindowMs
      ? existing
      : { count: 0, firstAttemptAt: now };

  state.count += 1;
  if (state.count >= maxLoginAttempts) {
    state.lockedUntil = now + loginLockMs;
  }

  loginAttempts.set(key, state);
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const loginKey = getLoginAttemptKey(request.ip, body.email);
    const throttledForMs = getLoginThrottleMs(loginKey);

    if (throttledForMs > 0) {
      await new AuditService(app.prisma).log({
        action: "LOGIN_FAILURE",
        summary: "Login attempt throttled after repeated failures.",
        metadata: {
          email: body.email,
          retryAfterSeconds: Math.ceil(throttledForMs / 1000)
        }
      });

      return reply.code(429).send({
        error: "Too many login attempts. Please wait a few minutes and try again."
      });
    }

    const user = await new AuthService(app.prisma).login(body.email, body.password);
    if (!user) {
      recordFailedLogin(loginKey);
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    loginAttempts.delete(loginKey);

    reply.setCookie(SESSION_COOKIE_NAME, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      signed: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 14
    });

    return { user };
  });

  app.post("/auth/logout", async (request, reply) => {
    if (request.currentUser) {
      await new AuditService(app.prisma).log({
        action: "LOGOUT",
        summary: `Logout for ${request.currentUser.email}.`,
        actorUserId: request.currentUser.id
      });
    }

    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      sameSite: "lax",
      secure: env.NODE_ENV === "production"
    });
    return { ok: true };
  });

  app.get("/auth/me", async (request) => ({
    user: request.currentUser ?? null
  }));

  app.post("/auth/change-password", async (request) => {
    const body = changePasswordSchema.parse(request.body);
    await new AuthService(app.prisma).changePassword(request.currentUser!.id, body.newPassword);
    return { ok: true };
  });
}
