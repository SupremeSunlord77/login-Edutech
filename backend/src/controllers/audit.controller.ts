import { Request, Response } from "express";
import { prisma } from "../config/database";

export const listAuditLogs = async (_req: Request, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ data: logs });
};
