import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test.afterAll(async()=>{const db=new PrismaClient();await db.job.deleteMany({where:{source:"E2E"}});await db.$disconnect()});

test("fluxo principal aparece em português",async({page})=>{await page.goto("/");await expect(page.getByRole("heading",{name:"Sua busca, com menos ruído."})).toBeVisible();await page.getByRole("link",{name:"Vagas",exact:true}).click();await expect(page.getByRole("heading",{name:"Nova vaga manual"})).toBeVisible();await expect(page.getByRole("button",{name:"Salvar e avaliar"})).toBeVisible()});

test("cadastra vaga manual e gera avaliação",async({page})=>{await page.goto("/vagas#nova");await page.getByLabel("Fonte").fill("E2E");await page.getByLabel("ID externo").fill(`e2e-${Date.now()}`);await page.getByLabel("Empresa").fill("Empresa de teste");await page.getByLabel("Cargo").fill("Desenvolvedor TypeScript");await page.getByLabel("Descrição do anúncio").fill("Anúncio fictício usado apenas no teste automatizado.");await page.getByLabel("Requisitos obrigatórios").fill("TypeScript\nSQL");await page.getByRole("button",{name:"Salvar e avaliar"}).click();await expect(page).toHaveURL(/\/vagas\/[a-z0-9]+$/);await expect(page.getByRole("heading",{name:"Desenvolvedor TypeScript"})).toBeVisible();await expect(page.getByRole("heading",{name:"Compatibilidade"})).toBeVisible();await expect(page.getByText(/Cobertura dos dados:/)).toBeVisible()});
