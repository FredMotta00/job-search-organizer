import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const source = "QA_CONTROLADO";

test.describe.serial("QA: busca por Dev Pleno de Teste", () => {
  test.beforeAll(async () => {
    await db.job.deleteMany({ where: { source } });
    const fixtures = [
      {
        externalId: "qa-dev-pleno-1",
        title: "Dev Pleno de Teste — TypeScript",
        company: "Empresa QA Compatível",
        description: "Dado fictício para validar busca e prioridade.",
        score: 92,
        category: "prioritária",
        incomplete: false,
        possibleDuplicate: false,
        hardBlocks: [] as string[],
      },
      {
        externalId: "qa-dev-pleno-2",
        title: "Dev Pleno de Teste — Dados incompletos",
        company: "Empresa QA Incompleta",
        description: "Dado fictício com informações ausentes.",
        score: 0,
        category: "baixa prioridade",
        incomplete: true,
        possibleDuplicate: false,
        hardBlocks: [] as string[],
      },
      {
        externalId: "qa-dev-pleno-3",
        title: "Dev Pleno de Teste — Possível duplicata",
        company: "Empresa QA Duplicata",
        description: "Dado fictício para validar sinalização entre fontes.",
        score: 70,
        category: "revisar",
        incomplete: false,
        possibleDuplicate: true,
        hardBlocks: [] as string[],
      },
      {
        externalId: "qa-dev-pleno-4",
        title: "Dev Pleno de Teste — Critério eliminatório",
        company: "Empresa QA Bloqueada",
        description: "Dado fictício para validar bloqueio separado da nota.",
        score: 86,
        category: "eliminada",
        incomplete: false,
        possibleDuplicate: false,
        hardBlocks: ["Empresa está na lista de exclusão."],
      },
    ];

    for (const fixture of fixtures) {
      await db.job.create({
        data: {
          source,
          externalId: fixture.externalId,
          title: fixture.title,
          company: fixture.company,
          description: fixture.description,
          incomplete: fixture.incomplete,
          possibleDuplicate: fixture.possibleDuplicate,
          assessment: {
            create: {
              score: fixture.score,
              category: fixture.category,
              coverage: fixture.incomplete ? 0 : 80,
              explanation: "Avaliação fictícia criada exclusivamente para QA.",
              hardBlocksJson: JSON.stringify(fixture.hardBlocks),
            },
          },
          histories: { create: { toStatus: "NOVA", note: "Fixture temporária de QA." } },
        },
      });
    }
  });

  test.afterAll(async () => {
    await db.job.deleteMany({ where: { source } });
    await db.$disconnect();
  });

  test("QA-01 encontra a vaga compatível e mostra prioridade", async ({ page }) => {
    await page.goto("/vagas");
    await page.getByLabel("Buscar").fill("Dev Pleno de Teste — TypeScript");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText("Empresa QA Compatível")).toBeVisible();
    await expect(page.getByText("92/100")).toBeVisible();
  });

  test("QA-02 encontra vaga incompleta e mostra o aviso", async ({ page }) => {
    await page.goto("/vagas?q=Dados%20incompletos");
    await expect(page.getByText("Empresa QA Incompleta")).toBeVisible();
    await expect(page.getByText("incompleta", { exact: true })).toBeVisible();
  });

  test("QA-03 encontra possível duplicata sem fundir registros", async ({ page }) => {
    await page.goto("/vagas?q=Poss%C3%ADvel%20duplicata");
    await expect(page.getByText("Empresa QA Duplicata")).toBeVisible();
    await expect(page.getByText("possível duplicata", { exact: true })).toBeVisible();
  });

  test("QA-04 preserva nota, mas exibe critério eliminatório", async ({ page }) => {
    await page.goto("/vagas?q=Crit%C3%A9rio%20eliminat%C3%B3rio");
    await page.getByText("Empresa QA Bloqueada").click();
    await expect(page.getByText("86", { exact: true })).toBeVisible();
    await expect(page.getByText("Critérios eliminatórios")).toBeVisible();
    await expect(page.getByText("Empresa está na lista de exclusão.")).toBeVisible();
  });
});
