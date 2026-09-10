import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Frame, type Locator, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { decideFieldValue, normalizeFieldText, type AssistantProfile, type ConfirmedAnswer } from "../src/lib/application-fields";

const prisma = new PrismaClient();
const runId = process.argv[2] || process.env.APPLICATION_ASSISTANT_RUN_ID;
const filled = new Map<string, { field: string; kind: string; page: string }>();
const pending = new Map<string, { field: string; reason: string; page: string }>();

function short(value: string, limit = 100) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

async function fieldLabel(locator: Locator) {
  return locator.evaluate((element) => {
    const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const explicit = field.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent : "";
    const wrapping = field.closest("label")?.textContent;
    return [explicit, wrapping, field.getAttribute("aria-label"), field.getAttribute("placeholder"), field.getAttribute("name"), field.id]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });
}

async function decorate(page: Page, status: string) {
  await page.evaluate((text) => {
    const id = "job-search-assistant-banner";
    let banner = document.getElementById(id);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = id;
      Object.assign(banner.style, {
        position: "fixed", top: "0", left: "0", right: "0", zIndex: "2147483647",
        background: "#13281f", color: "#f2f7f4", padding: "10px 16px", font: "600 14px system-ui",
        boxShadow: "0 2px 12px rgba(0,0,0,.35)", textAlign: "center",
      });
      document.documentElement.appendChild(banner);
    }
    banner.textContent = text;
  }, status).catch(() => undefined);
}

async function mark(locator: Locator, state: "filled" | "pending") {
  await locator.evaluate((element, nextState) => {
    const color = nextState === "filled" ? "#2f9e69" : "#d9862b";
    (element as HTMLElement).style.setProperty("outline", `3px solid ${color}`, "important");
    (element as HTMLElement).style.setProperty("outline-offset", "2px", "important");
    element.setAttribute("data-job-search-assistant", nextState);
  }, state).catch(() => undefined);
}

async function updateRun(status: "ACTIVE" | "REVIEW_READY") {
  await prisma.applicationAutomation.update({
    where: { id: runId! },
    data: {
      status,
      filledFieldsJson: JSON.stringify([...filled.values()]),
      pendingFieldsJson: JSON.stringify([...pending.values()]),
    },
  });
}

async function fillFrame(frame: Frame, data: {
  profile: AssistantProfile;
  answers: ConfirmedAnswer[];
  resumePath: string;
  introduction?: string | null;
  coverLetter?: string | null;
}) {
  const fields = frame.locator("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=reset]):not([disabled]), textarea:not([disabled]), select:not([disabled])");
  const count = await fields.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    if (!await field.isVisible().catch(() => false)) continue;
    const tag = await field.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    const type = (await field.getAttribute("type"))?.toLowerCase() || tag;
    const label = await fieldLabel(field).catch(() => "");
    const key = `${frame.url()}|${label}|${index}`;
    if (filled.has(key)) continue;

    if (type === "file") {
      if (/resume|curriculum|curriculo|cv|anexo|attachment/i.test(normalizeFieldText(label))) {
        await field.setInputFiles(data.resumePath).catch(() => undefined);
        filled.set(key, { field: short(label || "Anexo de currículo"), kind: "currículo", page: short(frame.url(), 160) });
        pending.delete(key);
        await mark(field, "filled");
      } else {
        pending.set(key, { field: short(label || "Arquivo"), reason: "Anexo não identificado como currículo", page: short(frame.url(), 160) });
        await mark(field, "pending");
      }
      continue;
    }

    const current = await field.inputValue().catch(() => "");
    if (current.trim()) continue;
    const decision = decideFieldValue({ label, type, tag, ...data });
    if (decision.action === "fill" && decision.value) {
      const changed = tag === "select"
        ? await field.selectOption({ label: decision.value }).then((values) => values.length > 0).catch(() => field.selectOption(decision.value).then((values) => values.length > 0).catch(() => false))
        : await field.fill(decision.value).then(() => true).catch(() => false);
      if (changed) {
        filled.set(key, { field: short(label || decision.kind), kind: decision.kind, page: short(frame.url(), 160) });
        pending.delete(key);
        await mark(field, "filled");
      } else {
        pending.set(key, { field: short(label || decision.kind), reason: "Valor confirmado não corresponde às opções do portal", page: short(frame.url(), 160) });
        await mark(field, "pending");
      }
    } else if (decision.action === "fill") {
      pending.set(key, { field: short(label || decision.kind), reason: "Dado ainda ausente no perfil", page: short(frame.url(), 160) });
      await mark(field, "pending");
    } else if (decision.action === "skip") {
      pending.set(key, { field: short(label || "Campo sem rótulo"), reason: decision.reason, page: short(frame.url(), 160) });
      await mark(field, "pending");
    }
  }
}

async function hasFinalSubmit(page: Page) {
  const pattern = /submit application|send application|enviar candidatura|finalizar candidatura|confirm application/i;
  if (await page.getByRole("button", { name: pattern }).first().isVisible().catch(() => false)) return true;
  return page.locator("input[type=submit]").evaluateAll((elements, source) => {
    const matcher = new RegExp(source, "i");
    return elements.some((element) => matcher.test((element as HTMLInputElement).value));
  }, pattern.source).catch(() => false);
}

async function main() {
  if (!runId) throw new Error("Identificador da sessão não informado.");
  const run = await prisma.applicationAutomation.findUnique({
    where: { id: runId },
    include: { job: true, resume: true, preparation: true },
  });
  if (!run) throw new Error("Sessão assistida não encontrada.");
  if (!run.job.url) throw new Error("A vaga não possui URL de candidatura.");
  if (!run.resume.confirmed || !run.resume.storedPath) throw new Error("O currículo precisa estar confirmado e possuir arquivo original.");
  await fs.access(run.resume.storedPath);

  const [profileRow, answerRows] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.answerEntry.findMany({ where: { confirmed: true } }),
  ]);
  if (!profileRow?.name || !profileRow.email) throw new Error("Complete nome e e-mail no perfil antes de iniciar.");

  const profile: AssistantProfile = {
    name: profileRow.name,
    email: profileRow.email,
    phone: profileRow.phone,
    location: profileRow.location,
    links: JSON.parse(profileRow.linksJson) as string[],
  };
  const answers: ConfirmedAnswer[] = answerRows.map((answer) => ({ question: answer.question, answer: answer.answer, sensitive: answer.sensitive }));
  const browserProfile = process.env.APPLICATION_ASSISTANT_PROFILE_DIR || path.join(process.cwd(), "data", "application-browser-profile");
  await fs.mkdir(browserProfile, { recursive: true });

  await prisma.applicationAutomation.update({ where: { id: run.id }, data: { status: "STARTING", startedAt: new Date(), lastError: null } });
  const context = await chromium.launchPersistentContext(browserProfile, {
    headless: process.env.APPLICATION_ASSISTANT_HEADLESS === "1",
    viewport: null,
    args: ["--start-maximized"],
  });
  const initialPage = context.pages()[0] ?? await context.newPage();
  await initialPage.goto(run.job.url, { waitUntil: "domcontentloaded", timeout: 60_000 });

  let open = true;
  context.on("close", () => { open = false; });
  const maxCycles = Math.max(0, Number(process.env.APPLICATION_ASSISTANT_MAX_CYCLES) || 0);
  let cycles = 0;
  while (open) {
    let reviewReady = false;
    for (const page of context.pages()) {
      await decorate(page, "Assistente ativo: verde = preenchido; laranja = revise. O envio final nunca é automático.");
      for (const frame of page.frames()) {
        await fillFrame(frame, {
          profile,
          answers,
          resumePath: run.resume.storedPath,
          introduction: run.preparation?.shortIntroduction,
          coverLetter: run.preparation?.coverLetter,
        }).catch(() => undefined);
      }
      reviewReady ||= await hasFinalSubmit(page);
    }
    await updateRun(reviewReady ? "REVIEW_READY" : "ACTIVE");
    cycles += 1;
    if (maxCycles && cycles >= maxCycles) {
      await context.close();
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  await prisma.applicationAutomation.update({ where: { id: run.id }, data: { status: "CLOSED", finishedAt: new Date() } });
}

main()
  .catch(async (error) => {
    if (runId) {
      await prisma.applicationAutomation.update({
        where: { id: runId },
        data: { status: "FAILED", lastError: short(error instanceof Error ? error.message : "Falha desconhecida", 500), finishedAt: new Date() },
      }).catch(() => undefined);
    }
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
