import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

const backupSchema = z.object({
  schemaVersion: z.literal(1), exportedAt: z.string(),
  profile: z.any().nullable(), settings: z.any().nullable(),
  jobs: z.array(z.any()), assessments: z.array(z.any()), resumes: z.array(z.any()),
  answers: z.array(z.any()), preparations: z.array(z.any()), histories: z.array(z.any()),
  automationRuns: z.array(z.any()).default([]),
});

type Db = PrismaClient | Prisma.TransactionClient;
const dates = <T extends Record<string, unknown>>(item: T, keys: string[]) => {
  const result: Record<string, unknown> = { ...item };
  for (const key of keys) if (typeof result[key] === "string") result[key] = new Date(result[key] as string);
  return result as T;
};

export async function exportBackup(db: Db) {
  const [profile, settings, jobs, assessments, resumes, answers, preparations, histories, automationRuns] = await Promise.all([
    db.profile.findUnique({ where: { id: 1 } }), db.settings.findUnique({ where: { id: 1 } }),
    db.job.findMany(), db.matchAssessment.findMany(), db.resume.findMany(), db.answerEntry.findMany(),
    db.applicationPreparation.findMany(), db.statusHistory.findMany(), db.applicationAutomation.findMany(),
  ]);
  return { schemaVersion: 1 as const, exportedAt: new Date().toISOString(), profile, settings, jobs, assessments, resumes, answers, preparations, histories, automationRuns };
}

export async function restoreBackup(client: PrismaClient, raw: unknown) {
  const data = backupSchema.parse(raw);
  await client.$transaction(async (db) => {
    await db.applicationAutomation.deleteMany(); await db.statusHistory.deleteMany(); await db.applicationPreparation.deleteMany(); await db.matchAssessment.deleteMany();
    await db.resume.deleteMany(); await db.answerEntry.deleteMany(); await db.job.deleteMany(); await db.profile.deleteMany(); await db.settings.deleteMany();
    if (data.profile) await db.profile.create({ data: dates(data.profile, ["createdAt","updatedAt"]) });
    if (data.settings) await db.settings.create({ data: dates(data.settings, ["createdAt","updatedAt"]) });
    for (const job of data.jobs) await db.job.create({ data: dates(job, ["publishedAt","importedAt","createdAt","updatedAt"]) });
    const remaining = [...data.resumes];
    while (remaining.length) {
      const index = remaining.findIndex((r) => !r.parentId || !remaining.some((x) => x.id === r.parentId));
      const [resume] = remaining.splice(index < 0 ? 0 : index, 1);
      await db.resume.create({ data: dates(resume, ["createdAt"]) });
    }
    for (const answer of data.answers) await db.answerEntry.create({ data: dates(answer, ["createdAt","updatedAt"]) });
    for (const assessment of data.assessments) await db.matchAssessment.create({ data: dates(assessment, ["createdAt","updatedAt"]) });
    for (const prep of data.preparations) await db.applicationPreparation.create({ data: dates(prep, ["createdAt"]) });
    for (const run of data.automationRuns) await db.applicationAutomation.create({ data: dates(run, ["startedAt","finishedAt","createdAt","updatedAt"]) });
    for (const history of data.histories) await db.statusHistory.create({ data: dates(history, ["createdAt"]) });
    await db.profile.upsert({ where:{id:1},update:{},create:{id:1} });
    await db.settings.upsert({ where:{id:1},update:{},create:{id:1} });
  });
}
