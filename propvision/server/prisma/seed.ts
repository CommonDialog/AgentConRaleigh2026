import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const agentPasswordHash = await bcrypt.hash("agent123", 10);

  await prisma.user.upsert({
    where: { email: "admin@propvision.local" },
    update: {},
    create: {
      email: "admin@propvision.local",
      passwordHash: adminPasswordHash,
      name: "Admin",
      role: "ADMIN",
      subscriptionTier: "ENTERPRISE",
      creditsBalance: 9999,
    },
  });

  await prisma.user.upsert({
    where: { email: "agent@propvision.local" },
    update: {},
    create: {
      email: "agent@propvision.local",
      passwordHash: agentPasswordHash,
      name: "Test Agent",
      role: "AGENT",
      subscriptionTier: "FREE",
      creditsBalance: 100,
    },
  });

  console.log("Seeded admin@propvision.local / admin123 and agent@propvision.local / agent123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
