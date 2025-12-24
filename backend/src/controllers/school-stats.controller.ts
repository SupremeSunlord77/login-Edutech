import { RequestHandler } from "express";
import { prisma } from "../config/database";

/* ================= GET DASHBOARD SUMMARY (Single API Call) ================= */
/**
 * Returns everything needed for the Index.tsx dashboard in one call
 */
export const getDashboardSummary: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    // Fetch all data in parallel
    const [grades, tutors, sectionCount, subjectNames] = await Promise.all([
      // Grades with sections and assignments
      prisma.grade.findMany({
        where: { schoolId, isActive: true },
        include: {
          sections: {
            where: { isActive: true },
            include: {
              classTutor: { select: { id: true, name: true } },
              subjects: {
                where: { isActive: true },
                include: {
                  tutorAssignments: {
                    where: { isActive: true },
                    include: {
                      tutor: { select: { id: true, name: true } },
                    },
                  },
                },
                orderBy: { name: 'asc' },
              },
            },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      }),
      
      // Tutors list for dropdown
      prisma.tutor.findMany({
        where: { schoolId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      
      // Total sections count
      prisma.section.count({
        where: { grade: { schoolId }, isActive: true },
      }),
      
      // All unique subject names in school
      prisma.sectionSubject.findMany({
        where: {
          section: { grade: { schoolId } },
          isActive: true,
        },
        select: { name: true },
        distinct: ['name'],
        orderBy: { name: 'asc' },
      }),
    ]);

    // Transform grades for frontend
    const gradesFormatted = grades.map((grade) => ({
      id: grade.id,
      name: grade.name,
      sectionsCount: grade.sections.length,
      sections: grade.sections.map((section) => ({
        id: section.id,
        name: section.name,
        classTutor: section.classTutor,
        subjects: section.subjects.map(subject => ({
          id: subject.id,
          name: subject.name,
          tutor: subject.tutorAssignments[0]?.tutor || null,
        })),
      })),
    }));

    res.json({
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
        district: school.district,
        isChainedSchool: school.isChainedSchool,
        studentCount: school.studentCount,
      },
      stats: {
        totalClasses: grades.length,
        totalSections: sectionCount,
        totalTutors: tutors.length,
      },
      grades: gradesFormatted,
      tutors,
      subjects: subjectNames.map(s => s.name),
    });
  } catch (error) {
    console.error("Get dashboard summary error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
};

/* ================= GET SCHOOL HEADER INFO ================= */
export const getSchoolHeader: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const [gradeCount, sectionCount, tutorCount] = await Promise.all([
      prisma.grade.count({ where: { schoolId, isActive: true } }),
      prisma.section.count({ where: { grade: { schoolId }, isActive: true } }),
      prisma.tutor.count({ where: { schoolId, isActive: true } }),
    ]);

    res.json({
      id: school.id,
      name: school.name,
      code: school.code,
      district: school.district,
      isChainedSchool: school.isChainedSchool,
      isActive: school.isActive,
      totalClasses: gradeCount,
      totalSections: sectionCount,
      totalTutors: tutorCount,
      studentCount: school.studentCount || 0,
    });
  } catch (error) {
    console.error("Get school header error:", error);
    res.status(500).json({ message: "Failed to fetch school info" });
  }
};

/* ================= GET SCHOOL STATS ================= */
export const getSchoolStats: RequestHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const [
      tutorCount,
      activeTutorCount,
      gradeCount,
      sectionCount,
      subjectCount,
      assignmentCount,
      sectionsWithClassTutor,
    ] = await Promise.all([
      prisma.tutor.count({ where: { schoolId } }),
      prisma.tutor.count({ where: { schoolId, isActive: true } }),
      prisma.grade.count({ where: { schoolId, isActive: true } }),
      prisma.section.count({ where: { grade: { schoolId }, isActive: true } }),
      prisma.sectionSubject.count({ 
        where: { section: { grade: { schoolId } }, isActive: true } 
      }),
      prisma.tutorSubjectAssignment.count({
        where: { tutor: { schoolId }, isActive: true },
      }),
      prisma.section.count({
        where: {
          grade: { schoolId },
          isActive: true,
          classTutorId: { not: null },
        },
      }),
    ]);

    res.json({
      totalStudents: school.studentCount || 0,
      totalTutors: tutorCount,
      activeTutors: activeTutorCount,
      totalGrades: gradeCount,
      totalSections: sectionCount,
      totalSubjects: subjectCount,
      totalAssignments: assignmentCount,
      sectionsWithClassTutor,
      sectionsWithoutClassTutor: sectionCount - sectionsWithClassTutor,
    });
  } catch (error) {
    console.error("Get school stats error:", error);
    res.status(500).json({ message: "Failed to fetch school stats" });
  }
};