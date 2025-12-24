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
  listTutorAssignments,
  listSectionAssignments,
  removeAssignment,
} from "../controllers/assignment.controller";

const router = Router({ mergeParams: true });

router.use(authenticate);

/* ================= SMART ASSIGN (Primary Endpoint) ================= */

/**
 * SMART ASSIGN TUTOR
 * POST /api/v1/schools/:schoolId/assignments/tutor-assignments
 * 
 * Body: {
 *   tutorId: string,
 *   assignments: { "Grade 1-A": ["English", "Maths"], ... },
 *   classGrade?: string,
 *   classSection?: string
 * }
 */
router.post(
  "/tutor-assignments",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  smartAssignTutor
);

/**
 * LIST ALL ASSIGNMENTS GROUPED BY TUTOR
 * GET /api/v1/schools/:schoolId/assignments/tutor-assignments
 * 
 * Returns: [{
 *   id, tutorId, tutorName,
 *   assignments: { "Grade 1-A": ["English"] },
 *   classGrade, classSection
 * }]
 */
router.get(
  "/tutor-assignments",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  listAssignmentsGrouped
);

/**
 * UPDATE TUTOR ASSIGNMENTS (Replace All)
 * PUT /api/v1/schools/:schoolId/assignments/tutor-assignments
 * 
 * Body: Same as smart assign
 */
router.put(
  "/tutor-assignments",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  updateTutorAssignments
);

/* ================= TUTOR-SPECIFIC ROUTES ================= */

/**
 * LIST ASSIGNMENTS FOR SPECIFIC TUTOR
 * GET /api/v1/schools/:schoolId/assignments/tutors/:tutorId
 */
router.get(
  "/tutors/:tutorId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  listTutorAssignments
);

/**
 * DELETE ALL ASSIGNMENTS FOR TUTOR
 * DELETE /api/v1/schools/:schoolId/assignments/tutors/:tutorId
 */
router.delete(
  "/tutors/:tutorId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  deleteAllTutorAssignments
);

/* ================= SECTION ROUTES ================= */

/**
 * LIST ASSIGNMENTS FOR SECTION
 * GET /api/v1/schools/:schoolId/assignments/sections/:sectionId
 */
router.get(
  "/sections/:sectionId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  listSectionAssignments
);

/**
 * ASSIGN CLASS TUTOR TO SECTION
 * POST /api/v1/schools/:schoolId/assignments/sections/:sectionId/class-tutor
 * Body: { tutorId: string }
 */
router.post(
  "/sections/:sectionId/class-tutor",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  assignClassTutor
);

/**
 * REMOVE CLASS TUTOR FROM SECTION
 * DELETE /api/v1/schools/:schoolId/assignments/sections/:sectionId/class-tutor
 */
router.delete(
  "/sections/:sectionId/class-tutor",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  removeClassTutor
);

/* ================= SINGLE ASSIGNMENT ================= */

/**
 * REMOVE SINGLE ASSIGNMENT
 * DELETE /api/v1/schools/:schoolId/assignments/:assignmentId
 */
router.delete(
  "/:assignmentId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  removeAssignment
);

export default router;