import { RequestHandler } from "express";
import { prisma } from "../config/database";
import { logAudit } from "../services/audit.service";
import { Role } from "@prisma/client";

/* ================= SMART ASSIGN TUTOR (Frontend-Compatible) ================= */
/**
 * Accepts the frontend format and creates/updates assignments
 * Works with SectionSubject model (subjects per section)
 * 
 * FIXED: Now properly prevents duplicate tutor-subject assignments
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
      const skippedAssignments: any[] = [];
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

            // ========== FIX: Check if assignment already exists (active or inactive) ==========
            const existingAssignment = await tx.tutorSubjectAssignment.findFirst({
              where: {
                tutorId,
                sectionSubjectId: sectionSubject.id,
              },
            });

            if (existingAssignment) {
              if (existingAssignment.isActive) {
                // Already assigned and active - skip with message
                skippedAssignments.push({
                  grade: gradeName,
                  section: sectionName,
                  subject: subjectName,
                  reason: "Already assigned",
                });
                continue;
              } else {
                // Exists but inactive - reactivate it
                await tx.tutorSubjectAssignment.update({
                  where: { id: existingAssignment.id },
                  data: { isActive: true },
                });
                createdAssignments.push({
                  id: existingAssignment.id,
                  grade: gradeName,
                  section: sectionName,
                  subject: subjectName,
                  reactivated: true,
                });
                continue;
              }
            }

            // Create new assignment
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
            // Check if another tutor is already class tutor
            if (section.classTutorId && section.classTutorId !== tutorId) {
              const existingClassTutor = await tx.tutor.findUnique({
                where: { id: section.classTutorId },
                select: { name: true },
              });
              errors.push(
                `Section ${classGrade}-${classSection} already has ${existingClassTutor?.name || 'another tutor'} as class tutor`
              );
            } else {
              // Update section with class tutor
              await tx.section.update({
                where: { id: section.id },
                data: { classTutorId: tutorId },
              });

              classTutorAssignment = {
                grade: classGrade,
                section: classSection,
              };
            }
          } else {
            errors.push(`Section ${classSection} not found in ${classGrade} for class tutor assignment`);
          }
        } else {
          errors.push(`Grade ${classGrade} not found for class tutor assignment`);
        }
      }

      return { createdAssignments, skippedAssignments, classTutorAssignment, errors };
    });

    // Audit log
    await logAudit({
      action: "ASSIGN_TUTOR",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "TutorAssignment",
      entityId: tutorId,
      metadata: {
        tutorName: tutor.name,
        assignmentsCount: result.createdAssignments.length,
        skippedCount: result.skippedAssignments.length,
        classTutor: result.classTutorAssignment,
      },
    });

    res.status(201).json({
      message: "Tutor assigned successfully",
      tutorId,
      tutorName: tutor.name,
      subjectAssignments: result.createdAssignments,
      skippedAssignments: result.skippedAssignments.length > 0 ? result.skippedAssignments : undefined,
      classTutorAssignment: result.classTutorAssignment,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("Smart assign tutor error:", error);
    
    // Handle unique constraint violation
    if ((error as any).code === 'P2002') {
      return res.status(409).json({ 
        message: "This tutor is already assigned to one or more of these subjects" 
      });
    }
    
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
          // Prevent duplicate subject names in the same key
          if (!assignments[key].includes(assignment.sectionSubject.name)) {
            assignments[key].push(assignment.sectionSubject.name);
          }
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
      metadata: { tutorName: tutor.name },
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

/* ================= ASSIGN SUBJECT TO TUTOR ================= */
/**
 * Assigns a single subject to a tutor
 * POST /api/v1/schools/:schoolId/assignments/subject
 * 
 * Body: { tutorId: string, sectionSubjectId: string }
 */
export const assignSubjectToTutor: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { tutorId, sectionSubjectId } = req.body;

    if (!tutorId || !sectionSubjectId) {
      return res.status(400).json({ message: "tutorId and sectionSubjectId are required" });
    }

    // Verify tutor exists and belongs to school
    const tutor = await prisma.tutor.findFirst({
      where: { id: tutorId, schoolId },
    });

    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found in this school" });
    }

    // Verify section subject exists
    const sectionSubject = await prisma.sectionSubject.findUnique({
      where: { id: sectionSubjectId },
      include: {
        section: {
          include: { grade: true },
        },
      },
    });

    if (!sectionSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    // ========== FIX: Check for existing assignment ==========
    const existingAssignment = await prisma.tutorSubjectAssignment.findFirst({
      where: {
        tutorId,
        sectionSubjectId,
      },
    });

    if (existingAssignment) {
      if (existingAssignment.isActive) {
        return res.status(409).json({ 
          message: `${tutor.name} is already assigned to teach ${sectionSubject.name} in ${sectionSubject.section.grade.name}-${sectionSubject.section.name}` 
        });
      } else {
        // Reactivate
        const reactivated = await prisma.tutorSubjectAssignment.update({
          where: { id: existingAssignment.id },
          data: { isActive: true },
        });
        return res.status(200).json({
          message: "Assignment reactivated",
          assignment: reactivated,
        });
      }
    }

    const assignment = await prisma.tutorSubjectAssignment.create({
      data: {
        tutorId,
        sectionSubjectId,
        isActive: true,
      },
    });

    await logAudit({
      action: "ASSIGN_SUBJECT_TO_TUTOR",
      actorId: req.user!.userId,
      actorRole: req.user!.role as Role,
      actorEmail: req.user!.email,
      entity: "TutorSubjectAssignment",
      entityId: assignment.id,
      metadata: {
        tutorName: tutor.name,
        subject: sectionSubject.name,
        section: `${sectionSubject.section.grade.name}-${sectionSubject.section.name}`,
      },
    });

    res.status(201).json({
      message: "Subject assigned to tutor successfully",
      assignment: {
        id: assignment.id,
        tutorId,
        tutorName: tutor.name,
        subject: sectionSubject.name,
        grade: sectionSubject.section.grade.name,
        section: sectionSubject.section.name,
      },
    });
  } catch (error) {
    console.error("Assign subject to tutor error:", error);
    
    // Handle unique constraint violation
    if ((error as any).code === 'P2002') {
      return res.status(409).json({ 
        message: "This tutor is already assigned to this subject" 
      });
    }
    
    res.status(500).json({ message: "Failed to assign subject" });
  }
};

/* ================= LIST SECTION ASSIGNMENTS ================= */
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

/* ================= CHECK DUPLICATE ASSIGNMENT ================= */
/**
 * Utility endpoint to check if a tutor is already assigned to a subject
 * GET /api/v1/schools/:schoolId/assignments/check-duplicate
 * 
 * Query: tutorId, sectionSubjectId
 */
export const checkDuplicateAssignment: RequestHandler = async (req, res) => {
  try {
    const { tutorId, sectionSubjectId } = req.query;

    if (!tutorId || !sectionSubjectId) {
      return res.status(400).json({ message: "tutorId and sectionSubjectId are required" });
    }

    const existingAssignment = await prisma.tutorSubjectAssignment.findFirst({
      where: {
        tutorId: tutorId as string,
        sectionSubjectId: sectionSubjectId as string,
        isActive: true,
      },
      include: {
        tutor: { select: { name: true } },
        sectionSubject: {
          select: { 
            name: true,
            section: {
              select: {
                name: true,
                grade: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (existingAssignment) {
      return res.json({
        isDuplicate: true,
        message: `${existingAssignment.tutor.name} is already assigned to ${existingAssignment.sectionSubject.name} in ${existingAssignment.sectionSubject.section.grade.name}-${existingAssignment.sectionSubject.section.name}`,
        existingAssignment: {
          id: existingAssignment.id,
          tutorName: existingAssignment.tutor.name,
          subject: existingAssignment.sectionSubject.name,
          section: `${existingAssignment.sectionSubject.section.grade.name}-${existingAssignment.sectionSubject.section.name}`,
        },
      });
    }

    res.json({ isDuplicate: false });
  } catch (error) {
    console.error("Check duplicate assignment error:", error);
    res.status(500).json({ message: "Failed to check assignment" });
  }
};