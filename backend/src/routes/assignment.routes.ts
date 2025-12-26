import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  smartAssignTutor,
  listAssignmentsGrouped,
  updateTutorAssignments,
  deleteAllTutorAssignments,
  assignClassTutor,
  removeClassTutor,
  assignSubjectToTutor,
  listSectionAssignments,
  removeAssignment,
  checkDuplicateAssignment,
} from "../controllers/assignment.controller";

const router = Router({ mergeParams: true });

router.use(authenticate);

/* ================= TUTOR ASSIGNMENTS ================= */

/**
 * SMART ASSIGN TUTOR (Frontend-Compatible)
 * POST /api/v1/schools/:schoolId/assignments
 * 
 * Assigns subjects and/or class tutor role to a tutor
 * Now properly prevents duplicate assignments
 * 
 * Body: {
 *   tutorId: string,
 *   assignments: {
 *     "Grade 1-A": ["English", "Maths"],
 *     "Grade 1-B": ["Science"],
 *   },
 *   classGrade?: string,
 *   classSection?: string
 * }
 * 
 * Response includes:
 * - subjectAssignments: successfully created
 * - skippedAssignments: already existed (with reason)
 * - errors: any issues encountered
 */
router.post(
  "/",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  smartAssignTutor
);

/**
 * LIST ALL ASSIGNMENTS GROUPED BY TUTOR
 * GET /api/v1/schools/:schoolId/assignments
 */
router.get(
  "/",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  listAssignmentsGrouped
);

/**
 * UPDATE TUTOR ASSIGNMENTS (Replace All)
 * PUT /api/v1/schools/:schoolId/assignments
 * 
 * Removes all existing assignments and creates new ones
 * 
 * Body: same as POST /assignments
 */
router.put(
  "/",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  updateTutorAssignments
);

/**
 * CHECK FOR DUPLICATE ASSIGNMENT
 * GET /api/v1/schools/:schoolId/assignments/check-duplicate
 * 
 * Query params: tutorId, sectionSubjectId
 * 
 * Returns: { isDuplicate: boolean, message?: string, existingAssignment?: object }
 */
router.get(
  "/check-duplicate",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  checkDuplicateAssignment
);

/**
 * ASSIGN SINGLE SUBJECT TO TUTOR
 * POST /api/v1/schools/:schoolId/assignments/subject
 * 
 * Body: { tutorId: string, sectionSubjectId: string }
 */
router.post(
  "/subject",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  assignSubjectToTutor
);

/**
 * DELETE ALL ASSIGNMENTS FOR TUTOR
 * DELETE /api/v1/schools/:schoolId/assignments/tutor/:tutorId
 */
router.delete(
  "/tutor/:tutorId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  deleteAllTutorAssignments
);

/**
 * REMOVE SINGLE ASSIGNMENT
 * DELETE /api/v1/schools/:schoolId/assignments/:assignmentId
 */
router.delete(
  "/:assignmentId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  removeAssignment
);

/* ================= CLASS TUTOR ================= */

/**
 * ASSIGN CLASS TUTOR
 * POST /api/v1/schools/:schoolId/assignments/sections/:sectionId/class-tutor
 * 
 * Body: { tutorId: string }
 */
router.post(
  "/sections/:sectionId/class-tutor",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  assignClassTutor
);

/**
 * REMOVE CLASS TUTOR
 * DELETE /api/v1/schools/:schoolId/assignments/sections/:sectionId/class-tutor
 */
router.delete(
  "/sections/:sectionId/class-tutor",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  removeClassTutor
);

/**
 * LIST SECTION ASSIGNMENTS
 * GET /api/v1/schools/:schoolId/assignments/sections/:sectionId
 */
router.get(
  "/sections/:sectionId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  listSectionAssignments
);

export default router;