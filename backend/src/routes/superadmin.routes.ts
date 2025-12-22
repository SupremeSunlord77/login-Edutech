import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { listAuditLogs } from "../controllers/audit.controller";
import { createSchool,listSchools,updateSchool,deleteSchool } from "../controllers/superadmin.controller";

const router = Router();

/**
 * SUPERADMIN DASHBOARD CHECK
 */
router.get(
  "/dashboard",
  authenticate,
  requireRole("SUPERADMIN"),
  (_req, res) => {
    res.json({ message: "Welcome SUPERADMIN" });
  }
);

/**
 * AUDIT LOGS
 */
router.get(
  "/audit-logs",
  authenticate,
  requireRole("SUPERADMIN"),
  listAuditLogs
);

/**
 * LIST SCHOOLS  ✅ (THIS FIXES 404)
 */
router.get(
  "/schools",
  authenticate,
  requireRole("SUPERADMIN"),
  listSchools
);

/**
 * CREATE SCHOOL
 */
router.post(
  "/schools",
  authenticate,
  requireRole("SUPERADMIN"),
  createSchool
);
/**
 * UPDATE SCHOOL
 */
router.put(
  "/schools/:id",
  authenticate,
  requireRole("SUPERADMIN"),
  updateSchool
);

/**
 * DELETE SCHOOL
 */
router.delete(
  "/schools/:id",
  authenticate,
  requireRole("SUPERADMIN"),
  deleteSchool
);
router.get("/__test", (_req, res) => {
  res.json({ ok: true });
});

export default router;
