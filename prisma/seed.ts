import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existingPeople = await prisma.person.count();
  if (existingPeople > 0) {
    console.log("Seed skipped: people already exist.");
    return;
  }

  const people = await prisma.person.createMany({
    data: [
      { name: "Alex Carter", employeeCode: "DB001" },
      { name: "Jordan Lee", employeeCode: "DB002" },
      { name: "Taylor Reed", employeeCode: "DB003" },
    ],
  });

  console.log(`Seeded ${people.count} people.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
