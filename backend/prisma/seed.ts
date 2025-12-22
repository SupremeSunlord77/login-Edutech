import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const hashedPassword = await bcrypt.hash("SuperAdmin@123", 12);

  await prisma.user.create({
    data: {
      email: "superadmin@system.com",
      password: hashedPassword,
      name: "System Super Admin",
      role: "SUPERADMIN",
    },
  });

  console.log("✅ SUPERADMIN created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
