"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface School {
  id: string;
  name: string;
  code?: string;
  address?: string;
  district?: string;
  pincode?: string;
  studentCount?: number;
  isActive: boolean;
  isChainedSchool?: boolean;
  admin?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

const emptyForm = {
  name: "",
  code: "",
  address: "",
  district: "",
  pincode: "",
  studentCount: "",
  isChainedSchool: false,
  isActive: true,
  adminName: "",
  adminPhone: "",
  adminEmail: "",
};

export default function SuperAdminDashboard() {
  const router = useRouter();

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  const [form, setForm] = useState<any>(emptyForm);

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastCounter, setToastCounter] = useState(0);

  // Toast helper function
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = toastCounter;
    setToastCounter(prev => prev + 1);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  /* ================= AUTH ================= */
  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        if (res.data.data.role !== "SUPERADMIN") {
          router.push("/login");
        }
      })
      .catch(() => {
        // Handle error
      });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    router.push("/login");
  };

  /* ================= LOAD SCHOOLS ================= */
  const loadSchools = async () => {
    try {
      const res = await api.get("/superadmin/schools");
      setSchools(res.data);
    } catch (err) {
      console.error("Failed to load schools:", err);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);
  
  const filteredSchools = schools.filter((s) =>
    (s.name || "").toLowerCase().includes(search.toLowerCase())
  );
  
  /* ================= CREATE / UPDATE ================= */
  const submitSchool = async () => {
    try {
      setLoading(true);

      const payload = {
        name: form.name,
        code: form.code,
        address: form.address,
        district: form.district,
        pincode: form.pincode,
        studentCount: Number(form.studentCount),
        isChainedSchool: form.isChainedSchool,
        isActive: form.isActive,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPhone: form.adminPhone,
      };

      if (editingSchool) {
        await api.put(`/superadmin/schools/${editingSchool.id}`, payload);
        showToast("School updated successfully!", "success");
        await loadSchools();
      } else {
        const res = await api.post("/superadmin/schools", payload);
        showToast(`School created! Admin: ${res.data.admin?.email || form.adminEmail} | Password: ${res.data.temporaryPassword}`, "success");
        await loadSchools();
      }
      
      closeModal();
    } catch (err: any) {
      console.error("Submit error:", err);
      showToast(err.response?.data?.message || "Operation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ================= DELETE ================= */
  const confirmDelete = async () => {
    if (!selectedSchool) return;
    try {
      await api.delete(`/superadmin/schools/${selectedSchool.id}`);
      showToast(`${selectedSchool.name} deleted successfully`, "success");
      setShowDelete(false);
      await loadSchools();
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Failed to delete school", "error");
    }
  };

  const openEdit = (school: School) => {
    setEditingSchool(school);
    setForm({
      name: school.name,
      code: school.code ?? "",
      address: school.address ?? "",
      district: school.district ?? "",
      pincode: school.pincode ?? "",
      studentCount: school.studentCount ?? "",
      isChainedSchool: school.isChainedSchool ?? false,
      isActive: school.isActive,
      adminName: school.admin?.name ?? "",
      adminEmail: school.admin?.email ?? "",
      adminPhone: school.admin?.phone ?? "", 
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSchool(null);
    setForm(emptyForm);
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#1f2937] font-sans">

      {/* MAIN CONTENT */}
      <main className="max-w-[1400px] mx-auto px-8 py-10">
        
        <div className="mb-10">
             <h1 className="text-3xl font-bold text-gray-900 mb-2">School Management</h1>
             <p className="text-gray-500">Oversee performance, manage institutions, and configure system-wide settings.</p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
          <div className="relative flex-1 w-full md:max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle key="search-circle" cx="11" cy="11" r="8"></circle>
                <path key="search-path" d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white text-sm"
              placeholder="Search schools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                    viewMode === "grid" ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:bg-gray-50"
                }`}
                >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect key="r1" x="3" y="3" width="7" height="7"></rect>
                  <rect key="r2" x="14" y="3" width="7" height="7"></rect>
                  <rect key="r3" x="14" y="14" width="7" height="7"></rect>
                  <rect key="r4" x="3" y="14" width="7" height="7"></rect>
                </svg>
                Grid
                </button>
                <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                    viewMode === "list" ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:bg-gray-50"
                }`}
                >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line key="l1" x1="8" y1="6" x2="21" y2="6"></line>
                  <line key="l2" x1="8" y1="12" x2="21" y2="12"></line>
                  <line key="l3" x1="8" y1="18" x2="21" y2="18"></line>
                  <line key="l4" x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line key="l5" x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line key="l6" x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
                List
                </button>
            </div>

            <button
                onClick={() => setShowModal(true)}
                className="bg-[#0f1419] hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
                <span>+</span> Create School
            </button>
          </div>
        </div>

        {/* DATA DISPLAY */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchools.map((s) => (
              <div 
                key={s.id} 
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-[#1f2937] pr-4">{s.name}</h3>
                  <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-[#0f1419] bg-transparent hover:bg-gray-50 rounded transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path key="edit-p1" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path key="edit-p2" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button onClick={() => { setSelectedSchool(s); setShowDelete(true); }} className="p-1.5 text-gray-400 hover:text-red-600 bg-transparent hover:bg-red-50 rounded transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline key="del-poly" points="3 6 5 6 21 6"></polyline>
                          <path key="del-path" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
                    <span className="text-red-500">📍</span> {s.district || "Unknown District"}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2 text-sm text-[#1f2937] font-medium">
                    <span className="text-purple-600">👥</span> {s.studentCount ?? 0} Students
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    s.isActive 
                        ? "bg-[#d1fae5] text-[#065f46]" 
                        : "bg-[#fef3c7] text-[#92400e]" 
                  }`}>
                    {s.isActive ? "active" : "inactive"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {filteredSchools.map((s) => (
              <div key={s.id} className="flex justify-between px-6 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-semibold text-[#1f2937]">{s.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {s.district || "No District"} • {s.studentCount ?? 0} students
                  </p>
                </div>
                <div className="flex gap-3 items-center">
                  <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-[#0f1419] p-2 hover:bg-gray-100 rounded">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path key="list-edit-p1" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path key="list-edit-p2" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button onClick={() => { setSelectedSchool(s); setShowDelete(true); }} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline key="list-del-poly" points="3 6 5 6 21 6"></polyline>
                      <path key="list-del-path" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL (Create/Update) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">
                {editingSchool ? "Update School" : "Create School"}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="space-y-4">
                {/* School Name */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Name</label>
                    <input className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black" 
                        placeholder="e.g. Lincoln High School"
                        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                </div>
                
                {/* School Code */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Code</label>
                    <input className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                    value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                    />
                </div>

                {/* Address */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</label>
                    <input className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                        value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                    />
                </div>
                
                {/* District and Pincode */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">District</label>
                        <input className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                        value={form.district} onChange={e => setForm({ ...form, district: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pincode</label>
                        <input className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                        value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })}
                        />
                    </div>
                </div>

                {/* Student Count */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Count</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                    value={form.studentCount} onChange={e => setForm({ ...form, studentCount: e.target.value.replace(/[^0-9]/g, '') })}
                    />
                </div>

                {/* Checkboxes */}
                <div className="flex gap-6 pt-2">
                    <label className="flex gap-2 text-sm items-center cursor-pointer text-gray-700">
                    <input type="checkbox" className="rounded text-black focus:ring-0"
                        checked={form.isChainedSchool}
                        onChange={e => setForm({ ...form, isChainedSchool: e.target.checked })}
                    /> Chained School
                    </label>

                    <label className="flex gap-2 text-sm items-center cursor-pointer text-gray-700">
                        <input type="checkbox" className="rounded text-black focus:ring-0"
                        checked={form.isActive}
                        onChange={e => setForm({ ...form, isActive: e.target.checked })}
                        /> Active
                    </label>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {/* Admin Details Section Header */}
                <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Admin Details</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        {editingSchool ? "Update admin information for this school" : "Enter admin credentials for the new school"}
                    </p>
                </div>

                {/* Admin Name */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin Name</label>
                    <input className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                    value={form.adminName} 
                    onChange={e => setForm({ ...form, adminName: e.target.value })}
                    placeholder="e.g. John Doe"
                    />
                </div>

                {/* Admin Email */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin Email</label>
                    <input 
                        type="email"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                        value={form.adminEmail} 
                        onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                        placeholder="e.g. admin@school.com"
                    />
                </div>

                {/* Admin Phone */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin Phone</label>
                    <input 
                        type="tel"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                        value={form.adminPhone} 
                        onChange={e => setForm({ ...form, adminPhone: e.target.value })}
                        placeholder="e.g. +1 234 567 890"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 rounded-md text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={submitSchool} disabled={loading} className="bg-black text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50">
                {loading ? "Saving..." : (editingSchool ? "Save Changes" : "Create School")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl">
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Delete School?</h3>
            <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to remove <span className="font-bold text-gray-900">{selectedSchool?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDelete(false)} className="px-4 py-2 rounded-md text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={confirmDelete} className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 shadow-sm transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed bottom-6 left-6 z-[60] flex flex-col gap-3 max-w-md">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-left duration-300 ${
              toast.type === "success"
                ? "bg-[#d1fae5] border-[#065f46] text-[#065f46]"
                : toast.type === "error"
                ? "bg-[#fee2e2] border-[#991b1b] text-[#991b1b]"
                : "bg-[#dbeafe] border-[#1e40af] text-[#1e40af]"
            }`}
          >
            <div className="flex-1 text-sm font-medium break-words">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 hover:opacity-70 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}