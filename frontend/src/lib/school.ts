import { api } from "./api";

export async function createSchool(data: any) {
  const res = await api.post("/superadmin/schools", data);
  return res.data;
}

export async function fetchSchools() {
  const res = await api.get("/superadmin/schools");
  return res.data;
}
