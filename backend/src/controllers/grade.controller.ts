import { RequestHandler } from "express";
import { prisma } from "../config/database";
import { logAudit } from "../services/audit.service";
import { Role } from "@prisma/client";

/* ================= CREATE GRADE (with Sections and Subjects) ================= */
export const createGrade: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { gradeName, order, sections } = req.body;

    if (!gradeName || !sections || sections.length === 0) {
      return res.status(400).json({ 
        message: "gradeName and at least one section are required" 
      });
    }

    // Check if grade already exists
    const existingGrade = await prisma.grade.findFirst({
      where: { schoolId, name: gradeName },
    });

    if (existingGrade) {
      return res.status(409).json({ message: "Grade already exists in this school" });
    }

    // Get max order if not provided
    const gradeOrder = order ?? (await prisma.grade.count({ where: { schoolId } })) + 1;

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
      metadata: {
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
export const listGrades: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const grades = await prisma.grade.findMany({
      where: { schoolId, isActive: true },
      include: {
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
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Transform to include tutor info at subject level
    const gradesWithDetails = grades.map(grade => ({
      ...grade,
      sections: grade.sections.map(section => ({
        ...section,
        subjects: section.subjects.map(subject => ({
          id: subject.id,
          name: subject.name,
          // Primary tutor (first assigned)
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

/* ================= UPDATE GRADE (Basic Info Only) ================= */
/**
 * Updates only the grade's basic info (name, order, isActive)
 * Does NOT handle sections or subjects - use dedicated endpoints for those
 * 
 * Request body:
 * {
 *   name?: string,
 *   order?: number,
 *   isActive?: boolean
 * }
 */
export const updateGrade: RequestHandler = async (req, res) => {
  try {
    const { gradeId } = req.params;
    const { name, order, isActive } = req.body;

    const existingGrade = await prisma.grade.findUnique({
      where: { id: gradeId },
    });

    if (!existingGrade) {
      return res.status(404).json({ message: "Grade not found" });
    }

    // Check for name conflict if name is being updated
    if (name && name !== existingGrade.name) {
      const nameConflict = await prisma.grade.findFirst({
        where: {
          schoolId: existingGrade.schoolId,
          name,
          id: { not: gradeId },
        },
      });
      if (nameConflict) {
        return res.status(409).json({ message: "A grade with this name already exists" });
      }
    }

    const updatedGrade = await prisma.grade.update({
      where: { id: gradeId },
      data: {
        ...(name !== undefined && { name }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
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

    await logAudit({
      action: "UPDATE_GRADE",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Grade",
      entityId: gradeId,
      metadata: { 
        gradeName: updatedGrade.name,
        changes: { name, order, isActive },
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
      metadata: { gradeName: grade.name },
    });

    res.json({ message: "Grade deleted successfully" });
  } catch (error) {
    console.error("Delete grade error:", error);
    res.status(500).json({ message: "Failed to delete grade" });
  }
};

/* ================= ADD SECTION TO GRADE ================= */
/**
 * Appends a new section to an existing grade
 * POST /api/v1/schools/:schoolId/grades/:gradeId/sections
 * 
 * Body: { name: string, subjects?: string[] }
 */
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

    await logAudit({
      action: "ADD_SECTION",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Section",
      entityId: result.section.id,
      metadata: { 
        gradeId,
        gradeName: grade.name,
        sectionName: result.section.name,
        subjectsCount: result.subjects.length,
      },
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

/* ================= UPDATE SECTION ================= */
/**
 * Updates section name
 * PUT /api/v1/schools/:schoolId/grades/sections/:sectionId
 * 
 * Body: { name: string }
 */
export const updateSection: RequestHandler = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Section name is required" });
    }

    const existingSection = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { grade: true },
    });

    if (!existingSection) {
      return res.status(404).json({ message: "Section not found" });
    }

    // Check for name conflict
    if (name !== existingSection.name) {
      const nameConflict = await prisma.section.findFirst({
        where: {
          gradeId: existingSection.gradeId,
          name,
          id: { not: sectionId },
        },
      });
      if (nameConflict) {
        return res.status(409).json({ message: "A section with this name already exists in this grade" });
      }
    }

    const updatedSection = await prisma.section.update({
      where: { id: sectionId },
      data: { name },
      include: {
        subjects: { where: { isActive: true } },
      },
    });

    res.json(updatedSection);
  } catch (error) {
    console.error("Update section error:", error);
    res.status(500).json({ message: "Failed to update section" });
  }
};

/* ================= DELETE SECTION ================= */
export const deleteSection: RequestHandler = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    await prisma.section.delete({
      where: { id: sectionId },
    });

    await logAudit({
      action: "DELETE_SECTION",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Section",
      entityId: sectionId,
      metadata: { sectionName: section.name },
    });

    res.json({ message: "Section deleted successfully" });
  } catch (error) {
    console.error("Delete section error:", error);
    res.status(500).json({ message: "Failed to delete section" });
  }
};

/* ================= UPDATE SECTION SUBJECTS ================= */
/**
 * Updates the subjects for a specific section
 * This replaces the current subjects with the new list
 * PUT /api/v1/schools/:schoolId/grades/sections/:sectionId/subjects
 * 
 * Body: { subjects: string[] }
 */
export const updateSectionSubjects: RequestHandler = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { subjects } = req.body;

    if (!subjects || !Array.isArray(subjects)) {
      return res.status(400).json({ message: "subjects array is required" });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { 
        grade: true,
        subjects: { where: { isActive: true } },
      },
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentSubjects = section.subjects;
      const currentNames = currentSubjects.map(s => s.name);
      const newNames = subjects as string[];

      // Add new subjects that don't exist
      const toAdd = newNames.filter(name => !currentNames.includes(name));
      const addedSubjects = [];
      for (const subjectName of toAdd) {
        // Check if there's an inactive subject with same name - reactivate it
        const existingInactive = await tx.sectionSubject.findFirst({
          where: { sectionId, name: subjectName, isActive: false },
        });
        
        if (existingInactive) {
          const reactivated = await tx.sectionSubject.update({
            where: { id: existingInactive.id },
            data: { isActive: true },
          });
          addedSubjects.push(reactivated);
        } else {
          const newSubject = await tx.sectionSubject.create({
            data: {
              name: subjectName,
              sectionId,
              isActive: true,
            },
          });
          addedSubjects.push(newSubject);
        }
      }

      // Deactivate subjects that are no longer in the list
      const toDeactivate = currentSubjects.filter(s => !newNames.includes(s.name));
      for (const subject of toDeactivate) {
        await tx.sectionSubject.update({
          where: { id: subject.id },
          data: { isActive: false },
        });
      }

      return { added: addedSubjects, removed: toDeactivate };
    });

    // Fetch updated section with subjects
    const updatedSection = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        subjects: { 
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    await logAudit({
      action: "UPDATE_SECTION_SUBJECTS",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "Section",
      entityId: sectionId,
      metadata: {
        sectionName: section.name,
        gradeName: section.grade.name,
        addedCount: result.added.length,
        removedCount: result.removed.length,
        currentSubjects: subjects,
      },
    });

    res.json({
      id: updatedSection!.id,
      name: updatedSection!.name,
      subjects: updatedSection!.subjects.map(s => ({ id: s.id, name: s.name })),
      changes: {
        added: result.added.map(s => s.name),
        removed: result.removed.map(s => s.name),
      },
    });
  } catch (error) {
    console.error("Update section subjects error:", error);
    res.status(500).json({ message: "Failed to update section subjects" });
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

    // Check for existing subject (active or inactive)
    const existingSubject = await prisma.sectionSubject.findFirst({
      where: { sectionId, name },
    });

    if (existingSubject) {
      if (existingSubject.isActive) {
        return res.status(409).json({ message: "Subject already exists in this section" });
      } else {
        // Reactivate the existing subject
        const reactivated = await prisma.sectionSubject.update({
          where: { id: existingSubject.id },
          data: { isActive: true },
        });
        return res.status(200).json(reactivated);
      }
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

    const subject = await prisma.sectionSubject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

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