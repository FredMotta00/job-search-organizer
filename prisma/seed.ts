import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.profile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      desiredRolesJson: JSON.stringify(["Desenvolvedor Full-Stack"]),
      experiencesJson: JSON.stringify([
        "Atuação editável como desenvolvedor Full-Stack na GPECx",
        "Liderança técnica e revisão de código",
      ]),
      technologiesJson: JSON.stringify([
        "TypeScript", "JavaScript", "Python", "Java", "APIs", "SQL",
        "AWS", "GCP", "CI/CD", "Agentes de IA",
      ]),
      confirmedFactsJson: JSON.stringify([]),
    },
  });
  await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

main().finally(() => prisma.$disconnect());
