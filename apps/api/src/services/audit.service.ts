import type { PrismaClient, AuditAction } from "@prisma/client";
import { sanitizeForAudit } from "../security/sanitizer.js";

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async log(input: {
    action: AuditAction;
    summary: string;
    actorUserId?: string | null;
    metadata?: unknown;
    ipHash?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        summary: input.summary,
        actorUserId: input.actorUserId ?? null,
        ipHash: input.ipHash ?? null,
        metadata: sanitizeForAudit(input.metadata ?? {}) as object
      }
    });
  }
}
