import { Request, Response, RequestHandler } from "express";
import { prisma } from "../config/database";
import bcrypt from "bcrypt";

/* ================= PASSWORD HELPER ================= */
const generateTempPassword = () => {
  return Math.random().toString(36).slice(-8);
};

/* ================= CREATE SCHOOL ================= */
export const createSchool: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      code,
      address,
      district,       // ✅
      pincode,        // ✅
      studentCount,   // ✅
      isChainedSchool,
      adminName,
      adminPhone,
      adminEmail,
    } = req.body;


    if (!name || !code || !adminName || !adminEmail || !adminPhone) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* ----- CHECK SCHOOL CODE ----- */
    const existingSchool = await prisma.school.findUnique({
      where: { code },
    });
    if (existingSchool) {
      return res.status(409).json({ message: "School code already exists" });
    }

    /* ----- CHECK ADMIN EMAIL ----- */
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existingAdmin) {
      return res.status(409).json({ message: "Admin email already exists" });
    }

    /* ----- GENERATE PASSWORD ----- */
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    /* ----- TRANSACTION ----- */
    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name,
          code,
          address,
          district,
          pincode,
          studentCount,
          isChainedSchool,
          isActive: true,
        },
      });

      const admin = await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          phone: adminPhone,
          password: hashedPassword,
          role: "SCHOOL_ADMIN",
          schoolId: school.id,
        },
      });

      return { school, admin };
    });

    /* ----- RETURN (PASSWORD ONLY ONCE) ----- */
    return res.status(201).json({
      school: {
        ...result.school,
        admin: {
          id: result.admin.id,
          name: result.admin.name,
          email: result.admin.email,
          phone: result.admin.phone,
        }
      },
      admin: {
        email: result.admin.email,
        role: result.admin.role,
      },
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Create school failed" });
  }
};

/* ================= LIST SCHOOLS ================= */
export const listSchools: RequestHandler = async (_req, res) => {
  try {
    const schools = await prisma.school.findMany({
      include: {
        users: {
          where: {
            role: "SCHOOL_ADMIN"
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform the data to flatten admin info
    const schoolsWithAdmin = schools.map(school => ({
      ...school,
      admin: school.users[0] || null,
      users: undefined, // Remove users array from response
    }));

    res.json(schoolsWithAdmin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch schools" });
  }
}

/* ======================================================
   UPDATE SCHOOL (Full Parity with Create)
====================================================== */
export const updateSchool: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: "Request body is required" });
  }

  const {
    // School Fields
    name,
    code,           // ⚠️ Unique Check Required
    address,
    district,
    pincode,
    studentCount,
    isActive,
    isChainedSchool,
    
    // Admin Fields (To update the User table)
    adminName,
    adminEmail,     // ⚠️ Unique Check Required
    adminPhone,
  } = req.body;

  try {
    // 1. Check if School exists
    const existingSchool = await prisma.school.findUnique({
      where: { id },
    });

    if (!existingSchool) {
      return res.status(404).json({ message: "School not found" });
    }

    // 2. Validation: Check if NEW code conflicts with another school
    if (code && code !== existingSchool.code) {
      const codeExists = await prisma.school.findUnique({
        where: { code },
      });
      if (codeExists) {
        return res.status(409).json({ message: "School code already exists" });
      }
    }

    // 3. Validation: Check if NEW admin email conflicts with another user
    // We only perform this check if an Admin Email is provided to be updated
    let targetAdminId: string | null = null;

    // Check if ANY admin field is present in the request body (even if empty string)
    const hasAdminFields = 'adminName' in req.body || 'adminEmail' in req.body || 'adminPhone' in req.body;


    if (hasAdminFields) {
      // Find the admin associated with this school
      const schoolAdmin = await prisma.user.findFirst({
        where: { 
            schoolId: id,
            role: "SCHOOL_ADMIN" 
        },
      });

      if (schoolAdmin) {
        targetAdminId = schoolAdmin.id;
        
        // If email is changing, ensure it's unique (excluding current user)
        if (adminEmail && adminEmail !== schoolAdmin.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: adminEmail }
            });
            if (emailExists) {
                return res.status(409).json({ message: "Admin email already exists" });
            }
        }
      }
    }

    // 4. Perform Updates via Transaction
    // We use a transaction to ensure both School and User update, or neither does.
    await prisma.$transaction(async (tx) => {
      
      // A. Update School
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

      // B. Update Admin (only if fields provided and admin exists)
      if (targetAdminId && (adminName || adminEmail || adminPhone)) {
        await tx.user.update({
            where: { id: targetAdminId },
            data: {
                ...(adminName !== undefined && { name: adminName }),
                ...(adminEmail !== undefined && { email: adminEmail }),
                ...(adminPhone !== undefined && { phone: adminPhone }),
            }
        });
      }
    });

    // 5. Fetch the complete updated school with admin data
    const updatedSchool = await prisma.school.findUnique({
      where: { id },
      include: {
        users: {
          where: {
            role: "SCHOOL_ADMIN"
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    // 6. Transform and return
    const schoolWithAdmin = {
      ...updatedSchool,
      admin: updatedSchool?.users[0] || null,
      users: undefined, // Remove users array from response
    };

    res.json(schoolWithAdmin);

  } catch (error) {
    console.error("Update School Error:", error);
    res.status(500).json({ message: "Failed to update school" });
  }
};
/**
 * DELETE SCHOOL
 * DELETE /api/v1/superadmin/schools/:id
 */
export const deleteSchool: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    await prisma.$transaction(async (tx) => {
      // delete school admins first
      await tx.user.deleteMany({
        where: { schoolId: id },
      });

      // delete school
      await tx.school.delete({
        where: { id },
      });
    });

    res.json({ message: "School deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Delete school failed" });
  }
};