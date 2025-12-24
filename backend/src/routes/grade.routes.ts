import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  createGrade,
  listGrades,
  getGrade,
  updateGrade,
  deleteGrade,
  addSection,
  deleteSection,
  addSubjectToSection,
  deleteSubjectFromSection,
  getSchoolSubjects,
} from "../controllers/grade.controller";

const router = Router({ mergeParams: true });

router.use(authenticate);

/* ================= GRADES ================= */

/**
 * CREATE GRADE (with Sections and Subjects)
 * POST /api/v1/schools/:schoolId/grades
 * 
 * Body: {
 *   gradeName: string,
 *   order?: number,
 *   sections: [{ name: string, subjects?: string[] }]
 * }
 */
router.post(
  "/",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  createGrade
);

/**
 * LIST GRADES (with Sections, Subjects & Tutors)
 * GET /api/v1/schools/:schoolId/grades
 * 
 * Returns grades with sections, each section includes:
 * - classTutor info
 * - subjects with assigned tutors
 */
router.get(
  "/",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  listGrades
);

/**
 * GET GRADE BY ID
 * GET /api/v1/schools/:schoolId/grades/:gradeId
 */
router.get(
  "/:gradeId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  getGrade
);

/**
 * UPDATE GRADE (Comprehensive)
 * PUT /api/v1/schools/:schoolId/grades/:gradeId
 * 
 * Body: {
 *   name?: string,
 *   order?: number,
 *   isActive?: boolean,
 *   sections?: [{ id?: string, name: string, subjects?: string[] }],
 *   deleteSectionIds?: string[]
 * }
 */
router.put(
  "/:gradeId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  updateGrade
);

/**
 * DELETE GRADE
 * DELETE /api/v1/schools/:schoolId/grades/:gradeId
 */
router.delete(
  "/:gradeId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  deleteGrade
);

/* ================= SECTIONS ================= */

/**
 * ADD SECTION TO GRADE
 * POST /api/v1/schools/:schoolId/grades/:gradeId/sections
 * 
 * Body: { name: string, subjects?: string[] }
 */
router.post(
  "/:gradeId/sections",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  addSection
);

/**
 * DELETE SECTION
 * DELETE /api/v1/schools/:schoolId/grades/sections/:sectionId
 */
router.delete(
  "/sections/:sectionId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  deleteSection
);

/* ================= SECTION SUBJECTS ================= */

/**
 * ADD SUBJECT TO SECTION
 * POST /api/v1/schools/:schoolId/grades/sections/:sectionId/subjects
 * 
 * Body: { name: string }
 */
router.post(
  "/sections/:sectionId/subjects",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  addSubjectToSection
);

/**
 * DELETE SUBJECT FROM SECTION
 * DELETE /api/v1/schools/:schoolId/grades/section-subjects/:subjectId
 */
router.delete(
  "/section-subjects/:subjectId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  deleteSubjectFromSection
);

/* ================= SCHOOL SUBJECTS ================= */

/**
 * GET ALL UNIQUE SUBJECTS IN SCHOOL
 * GET /api/v1/schools/:schoolId/grades/subjects
 * 
 * Returns all unique subject names used across all sections
 */
router.get(
  "/subjects/all",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  getSchoolSubjects
);

export default router;