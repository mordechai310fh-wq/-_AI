import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.OWNER_USERNAME;
  const password = process.env.OWNER_PASSWORD;

  if (!username || !password) {
    throw new Error("OWNER_USERNAME / OWNER_PASSWORD not set in .env");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const owner = await prisma.user.upsert({
    where: { username },
    update: { role: "ADMIN", isOwner: true, hasAccess: true, bannedUntil: null },
    create: {
      username,
      passwordHash,
      role: "ADMIN",
      isOwner: true,
      hasAccess: true,
    },
  });

  console.log(`Owner admin ready: ${owner.username} (id: ${owner.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
