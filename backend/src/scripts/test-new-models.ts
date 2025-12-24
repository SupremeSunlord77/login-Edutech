import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNewModels() {
  try {
    console.log('🧪 Testing new models...\n');

    // 1. Get an existing school
    const school = await prisma.school.findFirst();
    if (!school) {
      console.log('❌ No schools found. Create a school first.');
      return;
    }
    console.log('✅ Found school:', school.name);

    // 2. Create a Grade
    const grade = await prisma.grade.create({
      data: {
        name: 'Grade 1',
        schoolId: school.id,
        order: 1,
        isActive: true,
      },
    });
    console.log('✅ Created grade:', grade.name);

    // 3. Create a Section
    const section = await prisma.section.create({
      data: {
        name: 'Section A',
        gradeId: grade.id,
        isActive: true,
      },
    });
    console.log('✅ Created section:', section.name);

    // 4. Create Subjects
    const subjects = await Promise.all([
      prisma.subject.create({
        data: { name: 'English', schoolId: school.id, isActive: true },
      }),
      prisma.subject.create({
        data: { name: 'Maths', schoolId: school.id, isActive: true },
      }),
      prisma.subject.create({
        data: { name: 'Science', schoolId: school.id, isActive: true },
      }),
    ]);
    console.log('✅ Created subjects:', subjects.map(s => s.name).join(', '));

    // 5. Create a Tutor
    const tutor = await prisma.tutor.create({
      data: {
        name: 'Test Tutor',
        email: `test.tutor.${Date.now()}@school.com`,
        phone: '+1234567890',
        schoolId: school.id,
        isActive: true,
      },
    });
    console.log('✅ Created tutor:', tutor.name);

    // 6. Assign tutor to subject in section
    const assignment = await prisma.tutorSubjectAssignment.create({
      data: {
        tutorId: tutor.id,
        subjectId: subjects[0].id,
        sectionId: section.id,
        isActive: true,
      },
    });
    console.log('✅ Created assignment');

    // 7. Query with relations
    const gradeWithDetails = await prisma.grade.findUnique({
      where: { id: grade.id },
      include: {
        school: true,
        sections: {
          include: {
            subjectAssignments: {
              include: {
                tutor: true,
                subject: true,
              },
            },
          },
        },
      },
    });

    console.log('\n✅ Query result:');
    console.log(JSON.stringify(gradeWithDetails, null, 2));

    console.log('\n✅ All tests passed! Migration successful!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewModels();