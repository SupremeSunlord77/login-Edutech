import { RequestHandler } from "express";
import { prisma } from "../config/database";
import { logAudit } from "../services/audit.service";
import { Role } from "@prisma/client";

/* ================= SMART ASSIGN TUTOR (Frontend-Compatible) ================= */
/**
 * Accepts the frontend format and creates/updates assignments
 * Works with SectionSubject model (subjects per section)
 * 
 * Request body:
 * {
 *   tutorId: string,
 *   assignments: {
 *     "Grade 1-A": ["English", "Maths"],
 *     "Grade 1-B": ["Science"],
 *     ...
 *   },
 *   classGrade?: string,    // e.g., "Grade 1" - for class tutor assignment
 *   classSection?: string   // e.g., "A" - for class tutor assignment
 * }
 */
export const smartAssignTutor: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { tutorId, assignments, classGrade, classSection } = req.body;

    if (!tutorId) {
      return res.status(400).json({ message: "tutorId is required" });
    }

    // Verify tutor exists and belongs to school
    const tutor = await prisma.tutor.findFirst({
      where: { id: tutorId, schoolId },
    });

    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found in this school" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdAssignments: any[] = [];
      const errors: string[] = [];

      // 1. Process subject assignments
      if (assignments && Object.keys(assignments).length > 0) {
        for (const [key, subjectNames] of Object.entries(assignments)) {
          // Parse key like "Grade 1-A" into grade name and section name
          const match = key.match(/^(.+)-([A-Z])$/);
          if (!match) {
            errors.push(`Invalid key format: ${key}. Expected format: "Grade X-A"`);
            continue;
          }

          const [, gradeName, sectionName] = match;

          // Find grade
          const grade = await tx.grade.findFirst({
            where: { schoolId, name: gradeName, isActive: true },
          });

          if (!grade) {
            errors.push(`Grade not found: ${gradeName}`);
            continue;
          }

          // Find section
          const section = await tx.section.findFirst({
            where: { gradeId: grade.id, name: sectionName, isActive: true },
          });

          if (!section) {
            errors.push(`Section ${sectionName} not found in ${gradeName}`);
            continue;
          }

          // Process each subject
          const subjects = subjectNames as string[];
          for (const subjectName of subjects) {
            // Find SectionSubject (subject within this section)
            let sectionSubject = await tx.sectionSubject.findFirst({
              where: { sectionId: section.id, name: subjectName, isActive: true },
            });

            // If subject doesn't exist in this section, create it
            if (!sectionSubject) {
              sectionSubject = await tx.sectionSubject.create({
                data: {
                  name: subjectName,
                  sectionId: section.id,
                  isActive: true,
                },
              });
            }

            // Check if assignment already exists
            const existingAssignment = await tx.tutorSubjectAssignment.findFirst({
              where: {
                tutorId,
                sectionSubjectId: sectionSubject.id,
              },
            });

            if (existingAssignment) {
              // Already assigned, skip
              continue;
            }

            // Create assignment
            const assignment = await tx.tutorSubjectAssignment.create({
              data: {
                tutorId,
                sectionSubjectId: sectionSubject.id,
                isActive: true,
              },
            });

            createdAssignments.push({
              id: assignment.id,
              grade: gradeName,
              section: sectionName,
              subject: subjectName,
            });
          }
        }
      }

      // 2. Process class tutor assignment
      let classTutorAssignment = null;
      if (classGrade && classSection) {
        const grade = await tx.grade.findFirst({
          where: { schoolId, name: classGrade, isActive: true },
        });

        if (grade) {
          const section = await tx.section.findFirst({
            where: { gradeId: grade.id, name: classSection, isActive: true },
          });

          if (section) {
            // Update section with class tutor
            await tx.section.update({
              where: { id: section.id },
              data: { classTutorId: tutorId },
            });

            classTutorAssignment = {
              grade: classGrade,
              section: classSection,
            };
          } else {
            errors.push(`Section ${classSection} not found in ${classGrade} for class tutor assignment`);
          }
        } else {
          errors.push(`Grade ${classGrade} not found for class tutor assignment`);
        }
      }

      return { createdAssignments, classTutorAssignment, errors };
    });

    // Audit log
    await logAudit({
      action: "ASSIGN_TUTOR",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "TutorAssignment",
      entityId: tutorId,
      metadata:{
        tutorName: tutor.name,
        assignmentsCount: result.createdAssignments.length,
        classTutor: result.classTutorAssignment,
      },
    });

    res.status(201).json({
      message: "Tutor assigned successfully",
      tutorId,
      tutorName: tutor.name,
      subjectAssignments: result.createdAssignments,
      classTutorAssignment: result.classTutorAssignment,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("Smart assign tutor error:", error);
    res.status(500).json({ message: "Failed to assign tutor" });
  }
};

/* ================= LIST ALL ASSIGNMENTS GROUPED BY TUTOR ================= */
/**
 * Returns all assignments in the format expected by frontend
 */
export const listAssignmentsGrouped: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;

    // Get all tutors with their assignments
    const tutors = await prisma.tutor.findMany({
      where: { schoolId, isActive: true },
      include: {
        subjectAssignments: {
          where: { isActive: true },
          include: {
            sectionSubject: {
              include: {
                section: {
                  include: {
                    grade: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
        classSections: {
          where: { isActive: true },
          include: {
            grade: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Transform to frontend format
    const groupedAssignments = tutors
      .filter(tutor => tutor.subjectAssignments.length > 0 || tutor.classSections.length > 0)
      .map(tutor => {
        // Group subject assignments by "Grade X-Section"
        const assignments: Record<string, string[]> = {};
        
        tutor.subjectAssignments.forEach(assignment => {
          const section = assignment.sectionSubject.section;
          const key = `${section.grade.name}-${section.name}`;
          if (!assignments[key]) {
            assignments[key] = [];
          }
          assignments[key].push(assignment.sectionSubject.name);
        });

        // Get class tutor info (first class section if any)
        const classSection = tutor.classSections[0];

        return {
          id: tutor.id,
          tutorId: tutor.id,
          tutorName: tutor.name,
          tutorEmail: tutor.email,
          assignments,
          classGrade: classSection ? classSection.grade.name : null,
          classSection: classSection ? classSection.name : null,
        };
      });

    res.json(groupedAssignments);
  } catch (error) {
    console.error("List assignments grouped error:", error);
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

/* ================= UPDATE TUTOR ASSIGNMENTS (Replace All) ================= */
/**
 * Replaces all assignments for a tutor with new ones
 */
export const updateTutorAssignments: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { tutorId, assignments, classGrade, classSection } = req.body;

    if (!tutorId) {
      return res.status(400).json({ message: "tutorId is required" });
    }

    // Verify tutor exists and belongs to school
    const tutor = await prisma.tutor.findFirst({
      where: { id: tutorId, schoolId },
    });

    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found in this school" });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Remove all existing subject assignments for this tutor
      await tx.tutorSubjectAssignment.deleteMany({
        where: { tutorId },
      });

      // 2. Remove class tutor assignments
      await tx.section.updateMany({
        where: { classTutorId: tutorId },
        data: { classTutorId: null },
      });
    });

    // 3. Create new assignments using smartAssignTutor logic
    req.body = { tutorId, assignments, classGrade, classSection };
    return smartAssignTutor(req, res, () => {});
  } catch (error) {
    console.error("Update tutor assignments error:", error);
    res.status(500).json({ message: "Failed to update assignments" });
  }
};

/* ================= DELETE ALL ASSIGNMENTS FOR TUTOR ================= */
export const deleteAllTutorAssignments: RequestHandler = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const tutor = await prisma.tutor.findUnique({
      where: { id: tutorId },
    });

    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    await prisma.$transaction(async (tx) => {
      // Remove all subject assignments
      await tx.tutorSubjectAssignment.deleteMany({
        where: { tutorId },
      });

      // Remove class tutor assignments
      await tx.section.updateMany({
        where: { classTutorId: tutorId },
        data: { classTutorId: null },
      });
    });

    await logAudit({
      action: "DELETE_ALL_TUTOR_ASSIGNMENTS",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "TutorAssignment",
      entityId: tutorId,
      metadata:{ tutorName: tutor.name },
    });

    res.json({ message: "All assignments removed successfully" });
  } catch (error) {
    console.error("Delete all tutor assignments error:", error);
    res.status(500).json({ message: "Failed to remove assignments" });
  }
};

/* ================= ASSIGN CLASS TUTOR ================= */
export const assignClassTutor: RequestHandler = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { tutorId } = req.body;

    if (!tutorId) {
      return res.status(400).json({ message: "tutorId is required" });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { grade: true },
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const tutor = await prisma.tutor.findUnique({
      where: { id: tutorId },
    });

    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    const updatedSection = await prisma.section.update({
      where: { id: sectionId },
      data: { classTutorId: tutorId },
      include: {
        classTutor: { select: { id: true, name: true, email: true } },
        grade: { select: { id: true, name: true } },
      },
    });

    res.json({
      message: "Class tutor assigned successfully",
      section: updatedSection,
    });
  } catch (error) {
    console.error("Assign class tutor error:", error);
    res.status(500).json({ message: "Failed to assign class tutor" });
  }
};

/* ================= REMOVE CLASS TUTOR ================= */
export const removeClassTutor: RequestHandler = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    await prisma.section.update({
      where: { id: sectionId },
      data: { classTutorId: null },
    });

    res.json({ message: "Class tutor removed successfully" });
  } catch (error) {
    console.error("Remove class tutor error:", error);
    res.status(500).json({ message: "Failed to remove class tutor" });
  }
};

/* ================= LIST ASSIGNMENTS FOR TUTOR ================= */
export const listTutorAssignments: RequestHandler = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const assignments = await prisma.tutorSubjectAssignment.findMany({
      where: {
        tutorId,
        isActive: true,
      },
      include: {
        sectionSubject: {
          include: {
            section: {
              include: {
                grade: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { sectionSubject: { section: { grade: { order: 'asc' } } } },
        { sectionSubject: { section: { name: 'asc' } } },
        { sectionSubject: { name: 'asc' } },
      ],
    });

    // Also get class sections
    const classSections = await prisma.section.findMany({
      where: {
        classTutorId: tutorId,
        isActive: true,
      },
      include: {
        grade: { select: { id: true, name: true } },
      },
    });

    res.json({
      subjectAssignments: assignments,
      classSections,
    });
  } catch (error) {
    console.error("List tutor assignments error:", error);
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

/* ================= LIST ASSIGNMENTS FOR SECTION ================= */
export const listSectionAssignments: RequestHandler = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        grade: { select: { id: true, name: true } },
        classTutor: { select: { id: true, name: true, email: true } },
        subjects: {
          where: { isActive: true },
          include: {
            tutorAssignments: {
              where: { isActive: true },
              include: {
                tutor: { select: { id: true, name: true, email: true, phone: true } },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    res.json(section);
  } catch (error) {
    console.error("List section assignments error:", error);
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

/* ================= REMOVE SINGLE ASSIGNMENT ================= */
export const removeAssignment: RequestHandler = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await prisma.tutorSubjectAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    await prisma.tutorSubjectAssignment.delete({
      where: { id: assignmentId },
    });

    res.json({ message: "Assignment removed successfully" });
  } catch (error) {
    console.error("Remove assignment error:", error);
    res.status(500).json({ message: "Failed to remove assignment" });
  }
};