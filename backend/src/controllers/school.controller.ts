import { RequestHandler } from "express";
import { prisma } from "../config/database";
import bcrypt from "bcrypt";
import { logAudit } from "../services/audit.service";
import { Role } from "@prisma/client";

export const createSchool: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      code,
      address,
      isChainedSchool,
      adminName,
      adminEmail,
    } = req.body;

    if (!name || !code || !adminName || !adminEmail) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exists = await prisma.school.findUnique({ where: { code } });
    if (exists) {
      return res.status(409).json({ message: "School code already exists" });
    }

    const tempPassword = "Admin@123";
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name,
          code,
          address,
          isChainedSchool,
          isActive: true,
        },
      });

      const admin = await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN,
          schoolId: school.id,
        },
      });

      /* ===== AUDIT LOG ===== */
      await logAudit({
        action: "CREATE_SCHOOL",
        actorId: req.user!.userId,
        actorRole: req.user!.role as Role,
        actorEmail: req.user!.email,
        entity: "School",
        entityId: school.id,
        metadata: {
          schoolName: school.name,
          schoolCode: school.code,
          adminEmail: admin.email,
        },
      });

      return { school, admin };
    });

    res.status(201).json({
      school: result.school,
      admin: result.admin,
      tempPassword,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Create school failed" });
  }
};

export const listSchools: RequestHandler = async (_req, res) => {
  try {
    const schools = await prisma.school.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(schools);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch schools" });
  }
};