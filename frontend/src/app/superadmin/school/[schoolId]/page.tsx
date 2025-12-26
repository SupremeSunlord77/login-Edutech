"use client";

import { Plus, X, Edit, Trash2, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface School {
  id: string;
  name: string;
  code: string;
  district?: string;
  isChainedSchool?: boolean;
  studentCount?: number;
}

interface Tutor {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Subject {
  id: string;
  name: string;
  tutor?: Tutor | null;
  tutors?: Tutor[];
}

interface Section {
  id: string;
  name: string;
  classTutor?: Tutor | null;
  subjects: Subject[];
}

interface Grade {
  id: string;
  name: string;
  order: number;
  sections: Section[];
}

interface Assignment {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorEmail?: string;
  assignments: Record<string, string[]>;
  classGrade: string | null;
  classSection: string | null;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function SchoolDashboard() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.schoolId as string;

  // Loading state
  const [loading, setLoading] = useState(true);

  // School data
  const [school, setSchool] = useState<School | null>(null);
  const [stats, setStats] = useState({ totalClasses: 0, totalSections: 0, totalTutors: 0 });
  const [grades, setGrades] = useState<Grade[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Modal states
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [isCreateTutorOpen, setIsCreateTutorOpen] = useState(false);
  const [isAssignTutorOpen, setIsAssignTutorOpen] = useState(false);

  // Class/Grade form
  const [classData, setClassData] = useState({
    id: null as string | null,
    name: "",
    sections: ["A"],
    sectionSubjects: { A: [] as string[] } as Record<string, string[]>,
  });
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // Tutor form
  const [tutorData, setTutorData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [editingTutorId, setEditingTutorId] = useState<string | null>(null);

  // Assignment form
  const [assignmentData, setAssignmentData] = useState({
    tutorId: "",
    assignments: {} as Record<string, string[]>,
    classGrade: "",
    classSection: "",
  });
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  // UI states
  const [expandedGrade, setExpandedGrade] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastCounter, setToastCounter] = useState(0);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = toastCounter;
    setToastCounter((prev) => prev + 1);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Available subjects for selection
  const availableSubjects = [
    "English",
    "Maths",
    "Science",
    "History",
    "Geography",
    "Social Studies",
    "Hindi",
    "Computer Science",
    "Physical Education",
    "Art",
  ];

  /* ================= LOAD DATA ================= */
  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/schools/${schoolId}/dashboard`);
      const data = res.data;

      setSchool(data.school);
      setStats(data.stats);
      setGrades(data.grades || []);
      setTutors(data.tutors || []);
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      showToast("Failed to load school data", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      const res = await api.get(`/schools/${schoolId}/assignments`);
      setAssignments(res.data || []);
    } catch (err) {
      console.error("Failed to load assignments:", err);
    }
  };

  const loadTutors = async () => {
    try {
      const res = await api.get(`/schools/${schoolId}/tutors?simple=true`);
      setTutors(res.data || []);
    } catch (err) {
      console.error("Failed to load tutors:", err);
    }
  };

  useEffect(() => {
    if (schoolId) {
      loadDashboard();
      loadAssignments();
    }
  }, [schoolId]);

  /* ================= CLASS/GRADE OPERATIONS ================= */
  const handleCreateClass = async () => {
    if (!classData.name.trim()) {
      showToast("Please enter a class name", "error");
      return;
    }

    try {
      if (editingClassId) {
        // Update grade name
        await api.put(`/schools/${schoolId}/grades/${editingClassId}`, {
          name: classData.name,
        });

        // Update each section's subjects
        const existingGrade = grades.find((g) => g.id === editingClassId);
        if (existingGrade) {
          for (const section of existingGrade.sections) {
            const sectionSubjects = classData.sectionSubjects[section.name] || [];
            await api.put(`/schools/${schoolId}/grades/sections/${section.id}/subjects`, {
              subjects: sectionSubjects,
            });
          }
        }

        showToast("Class updated successfully", "success");
      } else {
        // Create new grade with sections
        const sections = classData.sections.map((s) => ({
          name: s,
          subjects: classData.sectionSubjects[s] || [],
        }));

        await api.post(`/schools/${schoolId}/grades`, {
          gradeName: classData.name,
          sections,
        });

        showToast("Class created successfully", "success");
      }

      setIsCreateClassOpen(false);
      setEditingClassId(null);
      setClassData({
        id: null,
        name: "",
        sections: ["A"],
        sectionSubjects: { A: [] },
      });
      loadDashboard();
    } catch (err: any) {
      console.error("Class operation failed:", err);
      showToast(err.response?.data?.message || "Operation failed", "error");
    }
  };

  const handleEditClass = (grade: Grade) => {
    const sectionSubjects: Record<string, string[]> = {};
    grade.sections.forEach((s) => {
      sectionSubjects[s.name] = s.subjects.map((sub) => sub.name);
    });

    setClassData({
      id: grade.id,
      name: grade.name,
      sections: grade.sections.map((s) => s.name),
      sectionSubjects,
    });
    setEditingClassId(grade.id);
    setIsCreateClassOpen(true);
  };

  const handleDeleteClass = async (gradeId: string) => {
    if (!confirm("Are you sure you want to delete this class?")) return;

    try {
      await api.delete(`/schools/${schoolId}/grades/${gradeId}`);
      showToast("Class deleted successfully", "success");
      loadDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Delete failed", "error");
    }
  };

  /* ================= TUTOR OPERATIONS ================= */
  const handleCreateTutor = async () => {
    if (!tutorData.name.trim()) {
      showToast("Please enter tutor name", "error");
      return;
    }
    if (!tutorData.email.trim()) {
      showToast("Please enter tutor email", "error");
      return;
    }
    if (!tutorData.phone.trim()) {
      showToast("Please enter tutor phone", "error");
      return;
    }

    try {
      if (editingTutorId) {
        await api.put(`/schools/${schoolId}/tutors/${editingTutorId}`, tutorData);
        showToast("Tutor updated successfully", "success");
      } else {
        await api.post(`/schools/${schoolId}/tutors`, tutorData);
        showToast("Tutor created successfully", "success");
      }

      setIsCreateTutorOpen(false);
      setEditingTutorId(null);
      setTutorData({ name: "", email: "", phone: "" });
      loadDashboard();
      loadTutors();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Operation failed", "error");
    }
  };

  const handleEditTutor = (tutor: Tutor) => {
    setTutorData({
      name: tutor.name,
      email: tutor.email,
      phone: tutor.phone,
    });
    setEditingTutorId(tutor.id);
    setIsCreateTutorOpen(true);
  };

  const handleDeleteTutor = async (tutorId: string) => {
    if (!confirm("Are you sure you want to delete this tutor?")) return;

    try {
      await api.delete(`/schools/${schoolId}/tutors/${tutorId}`);
      showToast("Tutor deleted successfully", "success");
      loadDashboard();
      loadTutors();
      loadAssignments();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Delete failed", "error");
    }
  };

  /* ================= ASSIGNMENT OPERATIONS ================= */
  const handleAssignTutor = async () => {
    if (!assignmentData.tutorId) {
      showToast("Please select a tutor", "error");
      return;
    }

    const hasAnyAssignment = Object.values(assignmentData.assignments).some(
      (subjects) => Array.isArray(subjects) && subjects.length > 0
    );

    if (!hasAnyAssignment && !assignmentData.classGrade) {
      showToast("Please assign at least one subject or class tutor role", "error");
      return;
    }

    try {
      if (editingAssignmentId) {
        // Update - replace all assignments
        await api.put(`/schools/${schoolId}/assignments`, {
          tutorId: assignmentData.tutorId,
          assignments: assignmentData.assignments,
          classGrade: assignmentData.classGrade,
          classSection: assignmentData.classSection,
        });
        showToast("Assignment updated successfully", "success");
      } else {
        // Create new assignment
        await api.post(`/schools/${schoolId}/assignments`, {
          tutorId: assignmentData.tutorId,
          assignments: assignmentData.assignments,
          classGrade: assignmentData.classGrade,
          classSection: assignmentData.classSection,
        });
        showToast("Tutor assigned successfully", "success");
      }

      setIsAssignTutorOpen(false);
      setEditingAssignmentId(null);
      setAssignmentData({
        tutorId: "",
        assignments: {},
        classGrade: "",
        classSection: "",
      });
      setExpandedGrade(null);
      setExpandedSection(null);
      loadAssignments();
      loadDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Assignment failed", "error");
    }
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setAssignmentData({
      tutorId: assignment.tutorId,
      assignments: assignment.assignments,
      classGrade: assignment.classGrade || "",
      classSection: assignment.classSection || "",
    });
    setEditingAssignmentId(assignment.id);
    setIsAssignTutorOpen(true);
  };

  const handleDeleteAssignment = async (tutorId: string) => {
    if (!confirm("Are you sure you want to remove all assignments for this tutor?")) return;

    try {
      await api.delete(`/schools/${schoolId}/assignments/tutor/${tutorId}`);
      showToast("Assignments removed successfully", "success");
      loadAssignments();
      loadDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Delete failed", "error");
    }
  };

  /* ================= HELPER FUNCTIONS ================= */
  const addMoreSection = () => {
    const sectionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const lastSection = classData.sections[classData.sections.length - 1];
    const lastIndex = sectionLabels.indexOf(lastSection);
    if (lastIndex < sectionLabels.length - 1) {
      const nextSection = sectionLabels[lastIndex + 1];
      setClassData({
        ...classData,
        sections: [...classData.sections, nextSection],
        sectionSubjects: {
          ...classData.sectionSubjects,
          [nextSection]: [],
        },
      });
    }
  };

  const removeSection = (index: number) => {
    if (classData.sections.length > 1) {
      const sectionToRemove = classData.sections[index];
      const newSectionSubjects = { ...classData.sectionSubjects };
      delete newSectionSubjects[sectionToRemove];
      setClassData({
        ...classData,
        sections: classData.sections.filter((_, i) => i !== index),
        sectionSubjects: newSectionSubjects,
      });
    }
  };

  const toggleSubjectForClass = (section: string, subject: string) => {
    const currentSubjects = classData.sectionSubjects[section] || [];
    setClassData({
      ...classData,
      sectionSubjects: {
        ...classData.sectionSubjects,
        [section]: currentSubjects.includes(subject)
          ? currentSubjects.filter((s) => s !== subject)
          : [...currentSubjects, subject],
      },
    });
  };

  const getAssignmentKey = (gradeName: string, section: string) => `${gradeName}-${section}`;

  const toggleSubjectForSection = (gradeName: string, section: string, subject: string) => {
    const key = getAssignmentKey(gradeName, section);
    const currentSubjects = assignmentData.assignments[key] || [];

    if (currentSubjects.includes(subject)) {
      setAssignmentData({
        ...assignmentData,
        assignments: {
          ...assignmentData.assignments,
          [key]: currentSubjects.filter((s) => s !== subject),
        },
      });
    } else {
      setAssignmentData({
        ...assignmentData,
        assignments: {
          ...assignmentData.assignments,
          [key]: [...currentSubjects, subject],
        },
      });
    }
  };

  const getSubjectsForSection = (gradeName: string, section: string) => {
    const key = getAssignmentKey(gradeName, section);
    return assignmentData.assignments[key] || [];
  };

  // Get sections for a specific grade (for assignment modal)
  const getSectionsForGrade = (gradeName: string) => {
    const grade = grades.find((g) => g.name === gradeName);
    return grade?.sections.map((s) => s.name) || [];
  };

  // Get subjects available in a specific section
  const getAvailableSubjectsForSection = (gradeName: string, sectionName: string) => {
    const grade = grades.find((g) => g.name === gradeName);
    const section = grade?.sections.find((s) => s.name === sectionName);
    return section?.subjects.map((s) => s.name) || availableSubjects;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading school data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : toast.type === "error"
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-blue-50 border border-blue-200 text-blue-800"
            }`}
          >
            <span className="text-sm">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-5xl px-6 py-6 sm:px-8 sm:py-10">
        {/* Back Button */}
        <button
          onClick={() => router.push("/superadmin/dashboard")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Schools
        </button>

        {/* School Header */}
        <div className="mb-8">
          <h1 className="mb-3 text-3xl font-semibold text-gray-900">{school?.name || "School"}</h1>
          <div className="flex flex-wrap gap-2">
            {school?.code && (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-900">
                {school.code}
              </span>
            )}
            {school?.district && (
              <span className="inline-flex rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                {school.district}
              </span>
            )}
            {school?.isChainedSchool && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-700"></span>
                Chain School
              </span>
            )}
            <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-900">
              Total Classes: {stats.totalClasses}
            </span>
            <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-900">
              Total Sections: {stats.totalSections}
            </span>
            <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-900">
              Total Tutors: {stats.totalTutors}
            </span>
          </div>
        </div>

        {/* Assigned Teachers Section */}
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Assigned Teachers</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setIsCreateClassOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" />
                <span>Create Class</span>
              </button>
              <button
                onClick={() => setIsCreateTutorOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" />
                <span>Create Tutor</span>
              </button>
              <button
                onClick={() => {
                  setEditingAssignmentId(null);
                  setAssignmentData({
                    tutorId: "",
                    assignments: {},
                    classGrade: "",
                    classSection: "",
                  });
                  setIsAssignTutorOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-800"
              >
                <span>👤</span>
                <span>Assign Tutor</span>
              </button>
            </div>
          </div>

          {/* Assignment Cards */}
          {assignments.length > 0 && (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const isExpanded = expandedCardId === assignment.id;
                const assignmentDetails = Object.entries(assignment.assignments).map(([key, subjects]) => ({
                  key,
                  subjects: Array.isArray(subjects) ? subjects : [],
                }));

                return (
                  <div
                    key={assignment.id}
                    className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900">{assignment.tutorName}</h3>
                        {assignment.tutorEmail && (
                          <p className="text-sm text-gray-500">{assignment.tutorEmail}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditAssignment(assignment)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                        >
                          <Edit className="h-4 w-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(assignment.tutorId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </button>
                        <button
                          onClick={() => setExpandedCardId(isExpanded ? null : assignment.id)}
                          className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-gray-600 hover:bg-gray-50"
                        >
                          <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50 px-5 py-4">
                        {assignment.classGrade && assignment.classSection && (
                          <div className="mb-4 p-3 rounded-lg bg-white border border-gray-200">
                            <p className="text-xs font-medium text-gray-500 mb-2">Class Tutor</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {assignment.classGrade} - Section {assignment.classSection}
                            </p>
                          </div>
                        )}

                        {assignmentDetails.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-3">Grade & Section Assignments</p>
                            <div className="space-y-2">
                              {assignmentDetails.map(({ key, subjects }) =>
                                subjects.length > 0 ? (
                                  <div key={key} className="p-3 rounded-lg bg-white border border-gray-200">
                                    <p className="text-sm font-semibold text-gray-900 mb-2">{key}</p>
                                    <div className="flex flex-wrap gap-2">
                                      {subjects.map((subject) => (
                                        <span
                                          key={subject}
                                          className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
                                        >
                                          {subject}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Classes & Sections */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Classes & Sections</h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {grades.map((grade) => (
            <div key={grade.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">{grade.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                    {grade.sections.length} Sections
                  </span>
                  <button
                    onClick={() => handleEditClass(grade)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClass(grade.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sections within Grade */}
              {grade.sections.map((section) => {
                const sectionKey = `grade-${grade.id}-${section.name}`;
                const isExpanded = expandedSections[sectionKey];

                return (
                  <div key={section.id} className="mb-3">
                    <button
                      onClick={() =>
                        setExpandedSections({
                          ...expandedSections,
                          [sectionKey]: !isExpanded,
                        })
                      }
                      className="w-full rounded-lg bg-gray-50 p-3 text-left hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-medium text-gray-900">
                            {section.name}
                          </div>
                          <div className="flex flex-col">
                            <p className="text-xs text-gray-500">Section</p>
                            <p className="text-sm font-medium text-gray-900">
                              {section.classTutor?.name || "No Class Tutor"}
                            </p>
                          </div>
                        </div>
                        <svg
                          className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded Content - Subjects */}
                    {isExpanded && (
                      <div className="mt-2 ml-3 pl-3 border-l-2 border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Subjects</p>
                        <div className="flex flex-wrap gap-1.5">
                          {section.subjects.length > 0 ? (
                            section.subjects.map((subject) => (
                              <div
                                key={subject.id}
                                className="rounded-lg bg-gray-50 px-2.5 py-1.5 border border-gray-200"
                              >
                                <p className="text-xs text-gray-600 font-medium">{subject.name}</p>
                                <p className="text-xs text-gray-500">{subject.tutor?.name || "Unassigned"}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-400">No subjects assigned</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Create Class Modal */}
        {isCreateClassOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingClassId ? "Edit Class" : "Create Class"}
                </h3>
                <button
                  onClick={() => {
                    setIsCreateClassOpen(false);
                    setEditingClassId(null);
                    setClassData({
                      id: null,
                      name: "",
                      sections: ["A"],
                      sectionSubjects: { A: [] },
                    });
                  }}
                  className="text-gray-500 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Class Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Class Name</label>
                  <input
                    type="text"
                    value={classData.name}
                    onChange={(e) => setClassData({ ...classData, name: e.target.value })}
                    placeholder="Enter class name (e.g., Grade 1)"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>

                {/* Sections with Subjects */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">Sections & Subjects</label>
                  <div className="space-y-4">
                    {classData.sections.map((section, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-900">Section {section}</span>
                          {classData.sections.length > 1 && (
                            <button
                              onClick={() => removeSection(index)}
                              className="rounded-lg border border-red-300 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {/* Subjects Selection */}
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">Select Subjects</p>
                          <div className="grid grid-cols-2 gap-2">
                            {availableSubjects.map((subject) => (
                              <button
                                key={subject}
                                onClick={() => toggleSubjectForClass(section, subject)}
                                className={`py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all ${
                                  (classData.sectionSubjects[section] || []).includes(subject)
                                    ? "border-blue-600 bg-blue-50 text-blue-700"
                                    : "border-gray-300 bg-white text-gray-600 hover:border-blue-400"
                                }`}
                              >
                                {subject}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addMoreSection}
                    className="mt-3 w-full rounded-lg border-2 border-dashed border-gray-300 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
                  >
                    + Add Another Section
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setIsCreateClassOpen(false);
                    setEditingClassId(null);
                    setClassData({
                      id: null,
                      name: "",
                      sections: ["A"],
                      sectionSubjects: { A: [] },
                    });
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateClass}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  {editingClassId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Tutor Modal */}
        {isCreateTutorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTutorId ? "Edit Tutor" : "Create Tutor"}
                </h3>
                <button
                  onClick={() => {
                    setIsCreateTutorOpen(false);
                    setEditingTutorId(null);
                    setTutorData({ name: "", email: "", phone: "" });
                  }}
                  className="text-gray-500 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Name</label>
                  <input
                    type="text"
                    value={tutorData.name}
                    onChange={(e) => setTutorData({ ...tutorData, name: e.target.value })}
                    placeholder="Enter tutor name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
                  <input
                    type="email"
                    value={tutorData.email}
                    onChange={(e) => setTutorData({ ...tutorData, email: e.target.value })}
                    placeholder="Enter email"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={tutorData.phone}
                    onChange={(e) => setTutorData({ ...tutorData, phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setIsCreateTutorOpen(false);
                    setEditingTutorId(null);
                    setTutorData({ name: "", email: "", phone: "" });
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTutor}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  {editingTutorId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Tutor Modal */}
        {isAssignTutorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingAssignmentId ? "Edit Assignment" : "Assign Tutor"}
                </h3>
                <button
                  onClick={() => {
                    setIsAssignTutorOpen(false);
                    setEditingAssignmentId(null);
                    setAssignmentData({
                      tutorId: "",
                      assignments: {},
                      classGrade: "",
                      classSection: "",
                    });
                  }}
                  className="text-gray-500 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Select Tutor */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Select Tutor</label>
                  <select
                    value={assignmentData.tutorId}
                    onChange={(e) => setAssignmentData({ ...assignmentData, tutorId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="">Select a tutor</option>
                    {tutors.map((tutor) => (
                      <option key={tutor.id} value={tutor.id}>
                        {tutor.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grade & Section Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Assign Subjects by Grade & Section
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {grades.map((grade) => (
                      <div key={grade.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedGrade(expandedGrade === grade.order ? null : grade.order)}
                          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                        >
                          <span className="text-sm font-medium text-gray-900">{grade.name}</span>
                          <ChevronDown
                            className={`h-4 w-4 text-gray-500 transition-transform ${
                              expandedGrade === grade.order ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {expandedGrade === grade.order && (
                          <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-2">
                            {grade.sections.map((section) => {
                              const sectionKey = getAssignmentKey(grade.name, section.name);
                              const selectedSubjects = getSubjectsForSection(grade.name, section.name);
                              const isSectionExpanded = expandedSection === sectionKey;

                              return (
                                <div key={section.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                  <button
                                    onClick={() => setExpandedSection(isSectionExpanded ? null : sectionKey)}
                                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                        {section.name}
                                      </span>
                                      <span className="text-sm font-medium text-gray-900">Section {section.name}</span>
                                      {selectedSubjects.length > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                          ✓ {selectedSubjects.length}
                                        </span>
                                      )}
                                    </div>
                                    <ChevronDown
                                      className={`h-4 w-4 text-gray-500 transition-transform ${
                                        isSectionExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                                  </button>

                                  {isSectionExpanded && (
                                    <div className="px-3 py-3 bg-gray-50 border-t border-gray-200">
                                      <p className="text-xs font-medium text-gray-600 mb-2">
                                        Select Subjects for Section {section.name}
                                      </p>
                                      <div className="grid grid-cols-2 gap-2">
                                        {(section.subjects.length > 0
                                          ? section.subjects.map((s) => s.name)
                                          : availableSubjects
                                        ).map((subject) => (
                                          <button
                                            key={subject}
                                            onClick={() => toggleSubjectForSection(grade.name, section.name, subject)}
                                            className={`py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all ${
                                              selectedSubjects.includes(subject)
                                                ? "border-green-600 bg-green-50 text-green-700"
                                                : "border-gray-300 bg-white text-gray-600 hover:border-green-400"
                                            }`}
                                          >
                                            {subject}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Class Tutor Assignment */}
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Assign as Class Tutor (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Class Grade</label>
                      <select
                        value={assignmentData.classGrade}
                        onChange={(e) =>
                          setAssignmentData({
                            ...assignmentData,
                            classGrade: e.target.value,
                            classSection: "",
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="">Select Grade</option>
                        {grades.map((g) => (
                          <option key={g.id} value={g.name}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Section</label>
                      <select
                        value={assignmentData.classSection}
                        onChange={(e) =>
                          setAssignmentData({
                            ...assignmentData,
                            classSection: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={!assignmentData.classGrade}
                      >
                        <option value="">Select Section</option>
                        {getSectionsForGrade(assignmentData.classGrade).map((s) => (
                          <option key={s} value={s}>
                            Section {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setIsAssignTutorOpen(false);
                    setEditingAssignmentId(null);
                    setAssignmentData({
                      tutorId: "",
                      assignments: {},
                      classGrade: "",
                      classSection: "",
                    });
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignTutor}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  {editingAssignmentId ? "Update" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}