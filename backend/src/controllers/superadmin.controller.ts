import { RequestHandler } from "express";
import { prisma } from "../config/database";
import bcrypt from "bcrypt";

const generateTempPassword = () => Math.random().toString(36).slice(-8);

export const createSchool: RequestHandler = async (req, res) => {
  try {
    const { name, code, address, district, pincode, studentCount, isChainedSchool, adminName, adminPhone, adminEmail } = req.body;

    if (!name || !code || !adminName || !adminEmail || !adminPhone) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingSchool = await prisma.school.findUnique({ where: { code } });
    if (existingSchool) {
      return res.status(409).json({ message: "School code already exists" });
    }

    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingAdmin) {
      return res.status(409).json({ message: "Admin email already exists" });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: { name, code, address, district, pincode, studentCount, isChainedSchool, isActive: true },
      });

      const admin = await tx.user.create({
        data: { name: adminName, email: adminEmail, phone: adminPhone, password: hashedPassword, role: "SCHOOL_ADMIN", schoolId: school.id },
      });

      return { school, admin };
    });

    return res.status(201).json({
      school: { ...result.school, admin: { id: result.admin.id, name: result.admin.name, email: result.admin.email, phone: result.admin.phone } },
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Create school failed" });
  }
};

export const listSchools: RequestHandler = async (_req, res) => {
  try {
    const schools = await prisma.school.findMany({
      include: {
        users: { where: { role: "SCHOOL_ADMIN" }, select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { grades: true, tutors: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const schoolsWithAdmin = schools.map((school) => ({
      ...school,
      admin: school.users[0] || null,
      gradesCount: school._count.grades,
      tutorsCount: school._count.tutors,
      users: undefined,
      _count: undefined,
    }));

    res.json(schoolsWithAdmin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch schools" });
  }
};

export const getSchool: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        users: { where: { role: "SCHOOL_ADMIN" }, select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { grades: true, tutors: true } },
      },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    res.json({ ...school, admin: school.users[0] || null, users: undefined, _count: undefined });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch school" });
  }
};

export const updateSchool: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { name, code, address, district, pincode, studentCount, isActive, isChainedSchool, adminName, adminEmail, adminPhone } = req.body;

  try {
    const existingSchool = await prisma.school.findUnique({ where: { id } });
    if (!existingSchool) {
      return res.status(404).json({ message: "School not found" });
    }

    if (code && code !== existingSchool.code) {
      const codeExists = await prisma.school.findUnique({ where: { code } });
      if (codeExists) return res.status(409).json({ message: "School code already exists" });
    }

    let targetAdminId: string | null = null;
    if ("adminName" in req.body || "adminEmail" in req.body || "adminPhone" in req.body) {
      const admin = await prisma.user.findFirst({ where: { schoolId: id, role: "SCHOOL_ADMIN" } });
      if (admin) {
        targetAdminId = admin.id;
        if (adminEmail && adminEmail !== admin.email) {
          const emailExists = await prisma.user.findUnique({ where: { email: adminEmail } });
          if (emailExists) return res.status(409).json({ message: "Admin email already exists" });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.school.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(code !== undefined && { code }),
          ...(address !== undefined && { address }),
          ...(district !== undefined && { district }),
          ...(pincode !== undefined && { pincode }),
          ...(studentCount !== undefined && { studentCount }),
          ...(isActive !== undefined && { isActive }),
          ...(isChainedSchool !== undefined && { isChainedSchool }),
        },
      });

      if (targetAdminId) {
        await tx.user.update({
          where: { id: targetAdminId },
          data: {
            ...(adminName !== undefined && { name: adminName }),
            ...(adminEmail !== undefined && { email: adminEmail }),
            ...(adminPhone !== undefined && { phone: adminPhone }),
          },
        });
      }
    });

    const updatedSchool = await prisma.school.findUnique({
      where: { id },
      include: { users: { where: { role: "SCHOOL_ADMIN" }, select: { id: true, name: true, email: true, phone: true } } },
    });

    res.json({ ...updatedSchool, admin: updatedSchool?.users[0] || null, users: undefined });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update school" });
  }
};

export const deleteSchool: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) return res.status(404).json({ message: "School not found" });

    // Delete school - cascades delete:
    // - Users (via schoolId relation with onDelete: Cascade)
    // - Grades → Sections → SectionSubjects → TutorSubjectAssignments
    // - Tutors → User accounts (via tutorId relation with onDelete: Cascade)
    await prisma.school.delete({ where: { id } });

    res.json({ message: "School and all related data deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Delete school failed" });
  }
};

export const resetAdminPassword: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await prisma.user.findFirst({ where: { schoolId: id, role: "SCHOOL_ADMIN" } });
    if (!admin) return res.status(404).json({ message: "School admin not found" });

    const tempPassword = generateTempPassword();
    await prisma.user.update({ where: { id: admin.id }, data: { password: await bcrypt.hash(tempPassword, 10) } });

    res.json({ message: "Password reset successful", admin: { email: admin.email, name: admin.name }, temporaryPassword: tempPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reset password" });
  }
};