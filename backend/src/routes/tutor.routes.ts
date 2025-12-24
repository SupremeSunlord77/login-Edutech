import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  createTutor,
  listTutors,
  getTutor,
  updateTutor,
  deleteTutor,
  resetTutorPassword,
} from "../controllers/tutor.controller";

const router = Router({ mergeParams: true });

router.use(authenticate);

/**
 * LIST TUTORS
 * GET /api/v1/schools/:schoolId/tutors
 * 
 * Query params:
 * - simple=true  → Returns only [{ id, name }] for dropdowns
 * - isActive=true/false → Filter by active status
 * - search=string → Search by name or email
 */
router.get(
  "/",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  listTutors
);

/**
 * CREATE TUTOR
 * POST /api/v1/schools/:schoolId/tutors
 * 
 * Body: { name: string, email: string, phone: string }
 * Returns: { tutor: {...}, temporaryPassword: string }
 */
router.post(
  "/",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  createTutor
);

/**
 * GET TUTOR BY ID
 * GET /api/v1/schools/:schoolId/tutors/:tutorId
 */
router.get(
  "/:tutorId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN", "TEACHER"),
  getTutor
);

/**
 * UPDATE TUTOR
 * PUT /api/v1/schools/:schoolId/tutors/:tutorId
 * 
 * Body: { name?, email?, phone?, isActive? }
 */
router.put(
  "/:tutorId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  updateTutor
);

/**
 * DELETE TUTOR
 * DELETE /api/v1/schools/:schoolId/tutors/:tutorId
 * 
 * Query params:
 * - force=true → Delete even if tutor has assignments
 */
router.delete(
  "/:tutorId",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  deleteTutor
);

/**
 * RESET TUTOR PASSWORD
 * POST /api/v1/schools/:schoolId/tutors/:tutorId/reset-password
 * 
 * Returns: { message, tutor: {...}, temporaryPassword: string }
 */
router.post(
  "/:tutorId/reset-password",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  resetTutorPassword
);

export default router;