import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

export const requireRole =
  (...allowedRoles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 1️⃣ Role check
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 2️⃣ SUPERADMIN is system-level (not school-scoped)
    if (req.user.role === Role.SUPERADMIN) {
      return next();
    }

    // 3️⃣ School-scoped roles must match schoolId in URL
    if (req.user.schoolId !== req.params.schoolId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
