import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/auth.routes";
import superadminRoutes from "./routes/superadmin.routes";

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(helmet());
app.use(express.json());

/* ===== ROUTES ===== */
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/superadmin", superadminRoutes);

/* ===== HEALTH CHECK ===== */
app.get("/", (_req, res) => {
  res.json({ status: "API running" });
});

export default app;
