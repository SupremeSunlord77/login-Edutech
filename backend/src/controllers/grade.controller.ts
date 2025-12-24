import { RequestHandler } from "express";
import { prisma } from "../config/database";
import { logAudit } from "../services/audit.service";
import { Role } from "@prisma/client";

/* ================= CREATE GRADE (with Sections and Subjects) ================= */
/**
 * Creates a new grade with sections and subjects per section.
 * Uses SectionSubject model (subjects are per-section).
 * 
 * Request body:
 * {
 *   gradeName: string,
 *   order?: number,
 *   sections: [{ name: string, subjects?: string[] }]
 * }
 */
export const createGrade: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { gradeName, order, sections } = req.body;

    // Validation
    if (!gradeName || !sections || sections.length === 0) {
      return res.status(400).json({ 
        message: "Missing required fields: gradeName and sections array" 
      });
    }

    // Verify school exists
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    // Check if grade already exists
    const existingGrade = await prisma.grade.findFirst({
      where: { schoolId, name: gradeName },
    });

    if (existingGrade) {
      return res.status(409).json({ message: "Grade already exists in this school" });
    }

    // Get next order if not provided
    let gradeOrder = order;
    if (!gradeOrder) {
      const maxOrder = await prisma.grade.aggregate({
        where: { schoolId },
        _max: { order: true },
      });
      gradeOrder = (maxOrder._max.order || 0) + 1;
    }

    // Create grade, sections, and subjects in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create grade
      const grade = await tx.grade.create({
        data: {
          name: gradeName,
          schoolId,
          order: gradeOrder,
          isActive: true,
        },
      });

      // 2. Create sections with their subjects
      const createdSections = [];
      
      for (const sectionData of sections) {
        const section = await tx.section.create({
          data: {
            name: sectionData.name,
            gradeId: grade.id,
            isActive: true,
          },
        });

        // 3. Create SectionSubjects for this section
        const sectionSubjects = [];
        if (sectionData.subjects && sectionData.subjects.length > 0) {
          for (const subjectName of sectionData.subjects) {
            const sectionSubject = await tx.sectionSubject.create({
              data: {
                name: subjectName,
                sectionId: section.id,
                isActive: true,
              },
            });
            sectionSubjects.push(sectionSubject);
          }
        }

        createdSections.push({
          ...section,
          subjects: sectionSubjects,
        });
      }

      return { grade, sections: createdSections };
    });

    // Audit log
    await logAudit({
      action: "CREATE_GRADE",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Grade",
      entityId: result.grade.id,
      metadata:{
        gradeName: result.grade.name,
        sectionsCount: result.sections.length,
        schoolId: schoolId,
      },
    });

    res.status(201).json({
      id: result.grade.id,
      name: result.grade.name,
      order: result.grade.order,
      sections: result.sections.map(s => ({
        id: s.id,
        name: s.name,
        subjects: s.subjects.map((sub: any) => ({ id: sub.id, name: sub.name })),
      })),
      message: "Grade created successfully",
    });
  } catch (error) {
    console.error("Create grade error:", error);
    res.status(500).json({ message: "Failed to create grade" });
  }
};

/* ================= LIST GRADES (with Sections, Subjects & Tutors) ================= */
/**
 * Returns grades with sections, each section includes:
 * - Class tutor info
 * - Subjects (SectionSubjects) with assigned tutors
 */
export const listGrades: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const grades = await prisma.grade.findMany({
      where: { 
        schoolId,
        isActive: true 
      },
      include: {
        sections: {
          where: { isActive: true },
          include: {
            classTutor: {
              select: { id: true, name: true, email: true },
            },
            subjects: {
              where: { isActive: true },
              include: {
                tutorAssignments: {
                  where: { isActive: true },
                  include: {
                    tutor: {
                      select: { id: true, name: true, email: true },
                    },
                  },
                },
              },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { order: "asc" },
    });

    // Transform to frontend-expected format
    const gradesWithDetails = grades.map((grade) => ({
      id: grade.id,
      name: grade.name,
      order: grade.order,
      sectionsCount: grade.sections.length,
      sections: grade.sections.map((section) => ({
        id: section.id,
        name: section.name,
        classTutor: section.classTutor || null,
        subjects: section.subjects.map(subject => ({
          id: subject.id,
          name: subject.name,
          // Get the first assigned tutor (or null if none)
          tutor: subject.tutorAssignments[0]?.tutor || null,
          // All assigned tutors
          tutors: subject.tutorAssignments.map(ta => ta.tutor),
        })),
      })),
    }));

    res.json(gradesWithDetails);
  } catch (error) {
    console.error("List grades error:", error);
    res.status(500).json({ message: "Failed to fetch grades" });
  }
};

/* ================= GET GRADE BY ID ================= */
export const getGrade: RequestHandler = async (req, res) => {
  try {
    const { gradeId } = req.params;

    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      include: {
        school: { select: { id: true, name: true, code: true } },
        sections: {
          where: { isActive: true },
          include: {
            classTutor: { select: { id: true, name: true, email: true } },
            subjects: {
              where: { isActive: true },
              include: {
                tutorAssignments: {
                  where: { isActive: true },
                  include: {
                    tutor: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!grade) {
      return res.status(404).json({ message: "Grade not found" });
    }

    res.json(grade);
  } catch (error) {
    console.error("Get grade error:", error);
    res.status(500).json({ message: "Failed to fetch grade" });
  }
};

/* ================= UPDATE GRADE (Comprehensive) ================= */
/**
 * Updates grade and manages sections/subjects
 * 
 * Request body:
 * {
 *   name?: string,
 *   order?: number,
 *   isActive?: boolean,
 *   sections?: [
 *     { id?: string, name: string, subjects?: string[] }  // id present = update, absent = create
 *   ],
 *   deleteSectionIds?: string[]
 * }
 */
export const updateGrade: RequestHandler = async (req, res) => {
  try {
    const { gradeId } = req.params;
    const { name, order, isActive, sections, deleteSectionIds } = req.body;

    const existingGrade = await prisma.grade.findUnique({
      where: { id: gradeId },
      include: { sections: { include: { subjects: true } } },
    });

    if (!existingGrade) {
      return res.status(404).json({ message: "Grade not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update grade basic info
      const grade = await tx.grade.update({
        where: { id: gradeId },
        data: {
          ...(name !== undefined && { name }),
          ...(order !== undefined && { order }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      // 2. Delete specified sections
      if (deleteSectionIds && deleteSectionIds.length > 0) {
        await tx.section.deleteMany({
          where: { 
            id: { in: deleteSectionIds },
            gradeId: gradeId,
          },
        });
      }

      // 3. Update/Create sections if provided
      if (sections && sections.length > 0) {
        for (const sectionData of sections) {
          if (sectionData.id) {
            // Update existing section
            await tx.section.update({
              where: { id: sectionData.id },
              data: { name: sectionData.name },
            });

            // Update subjects if provided
            if (sectionData.subjects) {
              // Get current subjects
              const currentSubjects = await tx.sectionSubject.findMany({
                where: { sectionId: sectionData.id },
              });
              const currentNames = currentSubjects.map(s => s.name);
              
              // Add new subjects
              for (const subjectName of sectionData.subjects) {
                if (!currentNames.includes(subjectName)) {
                  await tx.sectionSubject.create({
                    data: {
                      name: subjectName,
                      sectionId: sectionData.id,
                      isActive: true,
                    },
                  });
                }
              }

              // Deactivate removed subjects
              for (const current of currentSubjects) {
                if (!sectionData.subjects.includes(current.name)) {
                  await tx.sectionSubject.update({
                    where: { id: current.id },
                    data: { isActive: false },
                  });
                }
              }
            }
          } else {
            // Create new section
            const newSection = await tx.section.create({
              data: {
                name: sectionData.name,
                gradeId: gradeId,
                isActive: true,
              },
            });

            // Create subjects for new section
            if (sectionData.subjects && sectionData.subjects.length > 0) {
              for (const subjectName of sectionData.subjects) {
                await tx.sectionSubject.create({
                  data: {
                    name: subjectName,
                    sectionId: newSection.id,
                    isActive: true,
                  },
                });
              }
            }
          }
        }
      }

      return grade;
    });

    // Fetch updated grade with all relations
    const updatedGrade = await prisma.grade.findUnique({
      where: { id: gradeId },
      include: {
        sections: {
          where: { isActive: true },
          include: {
            subjects: { where: { isActive: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    res.json(updatedGrade);
  } catch (error) {
    console.error("Update grade error:", error);
    res.status(500).json({ message: "Failed to update grade" });
  }
};

/* ================= DELETE GRADE ================= */
export const deleteGrade: RequestHandler = async (req, res) => {
  try {
    const { gradeId } = req.params;

    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
    });

    if (!grade) {
      return res.status(404).json({ message: "Grade not found" });
    }

    // Delete grade (cascade will delete sections, sectionSubjects, and assignments)
    await prisma.grade.delete({
      where: { id: gradeId },
    });

    await logAudit({
      action: "DELETE_GRADE",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Grade",
      entityId: gradeId,
      metadata:{ gradeName: grade.name },
    });

    res.json({ message: "Grade deleted successfully" });
  } catch (error) {
    console.error("Delete grade error:", error);
    res.status(500).json({ message: "Failed to delete grade" });
  }
};

/* ================= ADD SECTION TO GRADE ================= */
export const addSection: RequestHandler = async (req, res) => {
  try {
    const { gradeId } = req.params;
    const { name, subjects } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Section name is required" });
    }

    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
    });

    if (!grade) {
      return res.status(404).json({ message: "Grade not found" });
    }

    const existingSection = await prisma.section.findFirst({
      where: { gradeId, name },
    });

    if (existingSection) {
      return res.status(409).json({ message: "Section already exists in this grade" });
    }

    // Create section with subjects
    const result = await prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          name,
          gradeId,
          isActive: true,
        },
      });

      const createdSubjects = [];
      if (subjects && subjects.length > 0) {
        for (const subjectName of subjects) {
          const sectionSubject = await tx.sectionSubject.create({
            data: {
              name: subjectName,
              sectionId: section.id,
              isActive: true,
            },
          });
          createdSubjects.push(sectionSubject);
        }
      }

      return { section, subjects: createdSubjects };
    });

    res.status(201).json({
      id: result.section.id,
      name: result.section.name,
      subjects: result.subjects.map(s => ({ id: s.id, name: s.name })),
    });
  } catch (error) {
    console.error("Add section error:", error);
    res.status(500).json({ message: "Failed to add section" });
  }
};

/* ================= DELETE SECTION ================= */
export const deleteSection: RequestHandler = async (req, res) => {
  try {
    const { sectionId } = req.params;

    await prisma.section.delete({
      where: { id: sectionId },
    });

    res.json({ message: "Section deleted successfully" });
  } catch (error) {
    console.error("Delete section error:", error);
    res.status(500).json({ message: "Failed to delete section" });
  }
};

/* ================= ADD SUBJECT TO SECTION ================= */
export const addSubjectToSection: RequestHandler = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Subject name is required" });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const existingSubject = await prisma.sectionSubject.findFirst({
      where: { sectionId, name },
    });

    if (existingSubject) {
      return res.status(409).json({ message: "Subject already exists in this section" });
    }

    const sectionSubject = await prisma.sectionSubject.create({
      data: {
        name,
        sectionId,
        isActive: true,
      },
    });

    res.status(201).json(sectionSubject);
  } catch (error) {
    console.error("Add subject to section error:", error);
    res.status(500).json({ message: "Failed to add subject" });
  }
};

/* ================= DELETE SUBJECT FROM SECTION ================= */
export const deleteSubjectFromSection: RequestHandler = async (req, res) => {
  try {
    const { subjectId } = req.params;

    await prisma.sectionSubject.delete({
      where: { id: subjectId },
    });

    res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    console.error("Delete subject from section error:", error);
    res.status(500).json({ message: "Failed to delete subject" });
  }
};

/* ================= GET ALL UNIQUE SUBJECTS IN SCHOOL ================= */
/**
 * Returns all unique subject names used across all sections in the school
 * Useful for showing available subjects in dropdowns
 */
export const getSchoolSubjects: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const subjects = await prisma.sectionSubject.findMany({
      where: {
        section: {
          grade: { schoolId },
        },
        isActive: true,
      },
      select: { name: true },
      distinct: ['name'],
      orderBy: { name: 'asc' },
    });

    res.json(subjects.map(s => s.name));
  } catch (error) {
    console.error("Get school subjects error:", error);
    res.status(500).json({ message: "Failed to fetch subjects" });
  }
};