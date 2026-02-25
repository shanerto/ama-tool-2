/**
 * Seed script: creates the first AMA event if none exists.
 * Run with:  npm run db:seed
 *
 * Requires DATABASE_URL to be set in your environment / .env file.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.event.count();
  if (count > 0) {
    console.log(`Skipping seed — ${count} event(s) already exist.`);
    return;
  }

  const event = await prisma.event.create({
    data: {
      title: "Company All-Hands AMA",
      description: "Ask the leadership team anything!",
      isActive: true,
    },
  });

  console.log(`Created event: "${event.title}" (id: ${event.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
