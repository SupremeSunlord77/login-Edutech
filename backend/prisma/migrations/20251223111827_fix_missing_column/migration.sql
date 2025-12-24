/*
  Warnings:

  - You are about to drop the `Subject` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TutorClassAssignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `sectionId` on the `TutorSubjectAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `subjectId` on the `TutorSubjectAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `TutorSubjectAssignment` table. All the data in the column will be lost.
  - Added the required column `sectionSubjectId` to the `TutorSubjectAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Subject_schoolId_name_key";

-- DropIndex
DROP INDEX "TutorClassAssignment_tutorId_sectionId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Subject";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TutorClassAssignment";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "SectionSubject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SectionSubject_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "classTutorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Section_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Section_classTutorId_fkey" FOREIGN KEY ("classTutorId") REFERENCES "Tutor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Section" ("createdAt", "gradeId", "id", "isActive", "name", "updatedAt") SELECT "createdAt", "gradeId", "id", "isActive", "name", "updatedAt" FROM "Section";
DROP TABLE "Section";
ALTER TABLE "new_Section" RENAME TO "Section";
CREATE UNIQUE INDEX "Section_gradeId_name_key" ON "Section"("gradeId", "name");
CREATE TABLE "new_TutorSubjectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tutorId" TEXT NOT NULL,
    "sectionSubjectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TutorSubjectAssignment_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TutorSubjectAssignment_sectionSubjectId_fkey" FOREIGN KEY ("sectionSubjectId") REFERENCES "SectionSubject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TutorSubjectAssignment" ("createdAt", "id", "isActive", "tutorId", "updatedAt") SELECT "createdAt", "id", "isActive", "tutorId", "updatedAt" FROM "TutorSubjectAssignment";
DROP TABLE "TutorSubjectAssignment";
ALTER TABLE "new_TutorSubjectAssignment" RENAME TO "TutorSubjectAssignment";
CREATE UNIQUE INDEX "TutorSubjectAssignment_tutorId_sectionSubjectId_key" ON "TutorSubjectAssignment"("tutorId", "sectionSubjectId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "schoolId" TEXT,
    "tutorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "password", "phone", "role", "schoolId", "updatedAt") SELECT "createdAt", "email", "id", "name", "password", "phone", "role", "schoolId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_tutorId_key" ON "User"("tutorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SectionSubject_sectionId_name_key" ON "SectionSubject"("sectionId", "name");
