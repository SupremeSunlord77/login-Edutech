import { api } from "./api";

export async function createSchool(data: any) {
  const res = await api.post("/superadmin/schools", data);
  return res.data;
}

export async function fetchSchools() {
  const res = await api.get("/superadmin/schools");
  return res.data;
}
/* =========================
   SCHOOL DASHBOARD
========================= */

/**
 * GET School Dashboard Summary
 * Backend: GET /api/v1/schools/:schoolId/dashboard
 */
export const getSchoolDashboard = (schoolId: string) => {
  return api.get(`/schools/${schoolId}/dashboard`);
};

/**
 * GET School Header Info
 * Backend: GET /api/v1/schools/:schoolId/header
 */
export const getSchoolHeader = (schoolId: string) => {
  return api.get(`/schools/${schoolId}/header`);
};

/**
 * GET School Stats
 * Backend: GET /api/v1/schools/:schoolId/stats
 */
export const getSchoolStats = (schoolId: string) => {
  return api.get(`/schools/${schoolId}/stats`);
};