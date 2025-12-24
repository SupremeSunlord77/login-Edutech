import { RequestHandler } from "express";
import { prisma } from "../config/database";
import { logAudit } from "../services/audit.service";
import { Role } from "@prisma/client";
import bcrypt from "bcrypt";

const generateTempPassword = () => Math.random().toString(36).slice(-8);

/* ================= CREATE TUTOR ================= */
export const createTutor: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "Missing required fields: name, email, phone" });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const existingTutor = await prisma.tutor.findUnique({ where: { email } });
    if (existingTutor) {
      return res.status(409).json({ message: "Tutor email already exists" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "User email already exists" });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const tutor = await tx.tutor.create({
        data: { name, email, phone, schoolId, isActive: true },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          role: "TEACHER",
          schoolId,
          tutorId: tutor.id,
        },
      });

      return { tutor, user };
    });

    await logAudit({
      action: "CREATE_TUTOR",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Tutor",
      entityId: result.tutor.id,
      metadata:{ tutorName: result.tutor.name, tutorEmail: result.tutor.email, schoolId },
    });

    res.status(201).json({
      tutor: {
        id: result.tutor.id,
        name: result.tutor.name,
        email: result.tutor.email,
        phone: result.tutor.phone,
      },
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error("Create tutor error:", error);
    res.status(500).json({ message: "Failed to create tutor" });
  }
};

/* ================= LIST TUTORS ================= */
/**
 * Returns tutors list. 
 * Use ?simple=true for dropdown (returns only id, name)
 */
export const listTutors: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { isActive, search, simple } = req.query;

    const where: any = { schoolId };
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    // Simple mode for dropdowns
    if (simple === "true") {
      const tutors = await prisma.tutor.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      return res.json(tutors);
    }

    // Full mode with assignment info
    const tutors = await prisma.tutor.findMany({
      where,
      include: {
        classSections: {
          where: { isActive: true },
          include: { grade: { select: { id: true, name: true } } },
        },
        _count: {
          select: {
            subjectAssignments: { where: { isActive: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const tutorsWithSummary = tutors.map((tutor) => ({
      id: tutor.id,
      name: tutor.name,
      email: tutor.email,
      phone: tutor.phone,
      isActive: tutor.isActive,
      createdAt: tutor.createdAt,
      classTutorOf: tutor.classSections.map((s) => ({
        sectionId: s.id,
        sectionName: s.name,
        gradeName: s.grade.name,
      })),
      subjectAssignmentsCount: tutor._count.subjectAssignments,
    }));

    res.json(tutorsWithSummary);
  } catch (error) {
    console.error("List tutors error:", error);
    res.status(500).json({ message: "Failed to fetch tutors" });
  }
};

/* ================= GET TUTOR BY ID ================= */
export const getTutor: RequestHandler = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const tutor = await prisma.tutor.findUnique({
      where: { id: tutorId },
      include: {
        school: { select: { id: true, name: true, code: true } },
        classSections: {
          where: { isActive: true },
          include: { grade: { select: { id: true, name: true } } },
        },
        subjectAssignments: {
          where: { isActive: true },
          include: {
            sectionSubject: {
              include: {
                section: {
                  include: { grade: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    // Group assignments by grade-section
    const assignmentsGrouped: Record<string, string[]> = {};
    tutor.subjectAssignments.forEach(a => {
      const section = a.sectionSubject.section;
      const key = `${section.grade.name}-${section.name}`;
      if (!assignmentsGrouped[key]) {
        assignmentsGrouped[key] = [];
      }
      assignmentsGrouped[key].push(a.sectionSubject.name);
    });

    res.json({
      id: tutor.id,
      name: tutor.name,
      email: tutor.email,
      phone: tutor.phone,
      isActive: tutor.isActive,
      school: tutor.school,
      classTutorOf: tutor.classSections.map(s => ({
        sectionId: s.id,
        sectionName: s.name,
        gradeName: s.grade.name,
      })),
      assignments: assignmentsGrouped,
      assignmentsCount: tutor.subjectAssignments.length,
    });
  } catch (error) {
    console.error("Get tutor error:", error);
    res.status(500).json({ message: "Failed to fetch tutor" });
  }
};

/* ================= UPDATE TUTOR ================= */
export const updateTutor: RequestHandler = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { name, email, phone, isActive } = req.body;

    const existingTutor = await prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!existingTutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    if (email && email !== existingTutor.email) {
      const emailExists = await prisma.tutor.findUnique({ where: { email } });
      if (emailExists) {
        return res.status(409).json({ message: "Email already exists" });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const tutor = await tx.tutor.update({
        where: { id: tutorId },
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      // Update linked user
      await tx.user.updateMany({
        where: { tutorId },
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
        },
      });

      return tutor;
    });

    await logAudit({
      action: "UPDATE_TUTOR",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Tutor",
      entityId: result.id,
      metadata:{ changes: { name, email, phone, isActive } },
    });

    res.json(result);
  } catch (error) {
    console.error("Update tutor error:", error);
    res.status(500).json({ message: "Failed to update tutor" });
  }
};

/* ================= DELETE TUTOR ================= */
export const deleteTutor: RequestHandler = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const tutor = await prisma.tutor.findUnique({ 
      where: { id: tutorId },
      include: { 
        _count: { 
          select: { subjectAssignments: true, classSections: true } 
        } 
      },
    });
    
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    if (tutor._count.subjectAssignments > 0 || tutor._count.classSections > 0) {
      const { force } = req.query;
      if (force !== "true") {
        return res.status(400).json({ 
          message: `Tutor has ${tutor._count.subjectAssignments} subject assignments and is class tutor for ${tutor._count.classSections} sections. Use ?force=true to delete anyway.`,
          hasAssignments: true,
        });
      }
    }

    await prisma.tutor.delete({ where: { id: tutorId } });

    await logAudit({
      action: "DELETE_TUTOR",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Tutor",
      entityId: tutorId,
      metadata: { tutorName: tutor.name, tutorEmail: tutor.email },
    });

    res.json({ message: "Tutor deleted successfully" });
  } catch (error) {
    console.error("Delete tutor error:", error);
    res.status(500).json({ message: "Failed to delete tutor" });
  }
};

/* ================= RESET TUTOR PASSWORD ================= */
export const resetTutorPassword: RequestHandler = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const tutor = await prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    const user = await prisma.user.findFirst({ where: { tutorId } });
    if (!user) {
      return res.status(404).json({ message: "User account not found for this tutor" });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await logAudit({
      action: "RESET_TUTOR_PASSWORD",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Tutor",
      entityId: tutorId,
      metadata:{ tutorEmail: tutor.email },
    });

    res.json({
      message: "Password reset successful",
      tutor: { id: tutor.id, name: tutor.name, email: tutor.email },
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error("Reset tutor password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
};