import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/auth.routes";
import superadminRoutes from "./routes/superadmin.routes";
import tutorRoutes from "./routes/tutor.routes";
import gradeRoutes from "./routes/grade.routes";
import assignmentRoutes from "./routes/assignment.routes";
import schoolStatsRoutes from "./routes/school-stats.routes";

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(helmet());
app.use(express.json());

/* ===== ROUTES ===== */
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/superadmin", superadminRoutes);
app.use("/api/v1/schools/:schoolId/tutors", tutorRoutes);
app.use("/api/v1/schools/:schoolId/grades", gradeRoutes);
app.use("/api/v1/schools/:schoolId/assignments", assignmentRoutes);
app.use("/api/v1/schools", schoolStatsRoutes);

/* ===== HEALTH CHECK ===== */
app.get("/", (_req, res) => {
  res.json({ status: "API running" });
});

export default app;
