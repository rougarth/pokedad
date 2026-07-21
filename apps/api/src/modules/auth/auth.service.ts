import argon2 from "argon2";
import type { PrismaClient, User } from "@prisma/client";
import { AuditService } from "../../services/audit.service.js";

export const SESSION_COOKIE_NAME = "pokedad_session";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName
  };
}

export class AuthService {
  private readonly audit: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
  }

  async login(email: string, password: string): Promise<PublicUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      await this.audit.log({
        action: "LOGIN_FAILURE",
        summary: `Login failed for ${email.toLowerCase().trim()}.`,
        metadata: { email }
      });
      return null;
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await this.audit.log({
        action: "LOGIN_FAILURE",
        summary: `Login failed for ${user.email}.`,
        actorUserId: user.id,
        metadata: { email: user.email }
      });
      return null;
    }

    await this.audit.log({
      action: "LOGIN_SUCCESS",
      summary: `Login success for ${user.email}.`,
      actorUserId: user.id
    });

    return toPublicUser(user);
  }

  async getUser(userId: string): Promise<PublicUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? toPublicUser(user) : null;
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
    await this.audit.log({
      action: "PASSWORD_CHANGED",
      summary: "Dashboard password changed.",
      actorUserId: userId
    });
  }
}

