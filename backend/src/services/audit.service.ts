import { prisma } from "../config/database";
import { Role } from "@prisma/client";

interface AuditInput {
  action: string;
  actorId: string;
  actorRole: Role;
  actorEmail: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, any>;
}

export const logAudit = async (data: AuditInput) => {
  await prisma.auditLog.create({
    data: {
      action: data.action,
      actorId: data.actorId,
      actorRole: data.actorRole,
      actorEmail: data.actorEmail,
      entity: data.entity,
      entityId: data.entityId,
      metadata: data.metadata,
    },
  });
};
