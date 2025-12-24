import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  getDashboardSummary,
  getSchoolHeader,
  getSchoolStats,
} from "../controllers/school-stats.controller";

const router = Router({ mergeParams: true });

router.use(authenticate);

/**
 * GET DASHBOARD SUMMARY (Single call for Index.tsx)
 * GET /api/v1/schools/:schoolId/dashboard
 * 
 * Returns everything needed for the dashboard in one call:
 * - school: { id, name, code, district, isChainedSchool, studentCount }
 * - stats: { totalClasses, totalSections, totalTutors }
 * - grades: Array with sections/subjects/tutors
 * - tutors: Array for dropdown [{ id, name }]
 * - subjects: Array of unique subject names
 */
router.get(
  "/dashboard",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  getDashboardSummary
);

/**
 * GET SCHOOL HEADER INFO
 * GET /api/v1/schools/:schoolId/header
 * 
 * Returns simplified school info for header display
 */
router.get(
  "/header",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  getSchoolHeader
);

/**
 * GET SCHOOL STATS
 * GET /api/v1/schools/:schoolId/stats
 * 
 * Returns detailed statistics
 */
router.get(
  "/stats",
  requireRole("SUPERADMIN", "SCHOOL_ADMIN"),
  getSchoolStats
);

export default router;