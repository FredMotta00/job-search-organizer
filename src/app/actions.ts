"use server";

import { JobStatus, ResumeOrientation } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lines, parseJson } from "@/lib/json";
import { assessJob } from "@/lib/scoring";
import { neutralizeUntrustedText, normalizeJobUrl } from "@/lib/security";
import { validateTransition } from "@/lib/status";
import { buildDeterministicPreparation } from "@/lib/preparation";
import { OpenAiProvider } from "@/lib/ai";
import { choosePreferredResume } from "@/lib/application-fields";
import { launchApplicationAssistant } from "@/lib/automation-launcher";
import { runDiscoveryWithExecution } from "@/lib/discovery";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const optional = (data: FormData, key: string) => text(data, key) || null;

async function defaults() {
  const [profile, settings] = await Promise.all([
    prisma.profile.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, aiMonthlyLimit: Math.max(0, Number(process.env.OPENAI_MONTHLY_REQUEST_LIMIT) || 30) } }),
  ]);
  return { profile, settings };
}

export async function saveProfile(data: FormData) {
  const confirmedFacts = lines(data.get("confirmedFacts"));
  await prisma.profile.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {
      name: text(data, "name"), email: text(data, "email"), phone: text(data, "phone"),
      linksJson: JSON.stringify(lines(data.get("links"))), location: text(data, "location"),
      desiredRolesJson: JSON.stringify(lines(data.get("desiredRoles"))),
      senioritiesJson: JSON.stringify(lines(data.get("seniorities"))),
      experiencesJson: JSON.stringify(lines(data.get("experiences"))),
      technologiesJson: JSON.stringify(lines(data.get("technologies"))),
      languagesJson: JSON.stringify(lines(data.get("languages"))),
      educationJson: JSON.stringify(lines(data.get("education"))),
      workModesJson: JSON.stringify(lines(data.get("workModes"))),
      regionsJson: JSON.stringify(lines(data.get("regions"))),
      contractTypesJson: JSON.stringify(lines(data.get("contractTypes"))),
      salaryExpectations: JSON.stringify(lines(data.get("salaryExpectations"))),
      availability: text(data, "availability"),
      excludedCompanies: JSON.stringify(lines(data.get("excludedCompanies"))),
      confirmedFactsJson: JSON.stringify(confirmedFacts),
      onboardingComplete: data.get("onboardingComplete") === "on",
    },
  });
  revalidatePath("/perfil");
  redirect("/perfil?salvo=1");
}

export async function createJob(data: FormData) {
  let normalizedUrl: string | null;
  try {
    normalizedUrl = normalizeJobUrl(optional(data, "url"));
  } catch (error) {
    redirect(`/vagas?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível salvar a vaga.")}`);
  }
  const source = text(data, "source") || "Manual";
  const externalId = optional(data, "externalId");
  const rawUrl = optional(data, "url");
  if (normalizedUrl && await prisma.job.findFirst({ where: { normalizedUrl } })) redirect("/vagas?erro=duplicada");
  if (externalId && await prisma.job.findFirst({ where: { source, externalId } })) redirect("/vagas?erro=duplicada");
  const company = text(data, "company");
  const title = text(data, "title");
  if (!company || !title) redirect("/vagas?erro=campos");
  const possible = await prisma.job.findFirst({ where: { company, title, NOT: { source } } });
  const job = await prisma.job.create({ data: {
    source, externalId, url: rawUrl, normalizedUrl, company, title,
    description: neutralizeUntrustedText(text(data, "description")),
    requiredJson: JSON.stringify(lines(data.get("required"))),
    desiredJson: JSON.stringify(lines(data.get("desired"))),
    responsibilitiesJson: JSON.stringify(lines(data.get("responsibilities"))),
    languagesJson: JSON.stringify(lines(data.get("jobLanguages"))),
    location: optional(data, "location"), workMode: optional(data, "workMode"),
    seniority: optional(data, "seniority"), contractType: optional(data, "contractType"),
    salaryMin: optional(data, "salaryMin") ? Number(text(data, "salaryMin")) : null,
    salaryMax: optional(data, "salaryMax") ? Number(text(data, "salaryMax")) : null,
    currency: optional(data, "currency"), salaryPeriod: optional(data, "salaryPeriod"),
    incomplete: data.get("incomplete") === "on", possibleDuplicate: Boolean(possible),
    fieldOriginsJson: JSON.stringify({ all: "cadastro manual" }),
  }});
  const { profile, settings } = await defaults();
  const result = assessJob(job, profile, settings);
  await prisma.matchAssessment.create({ data: {
    jobId: job.id, score: result.score, category: result.category, coverage: result.coverage,
    explanation: result.explanation, matchedJson: JSON.stringify(result.matched),
    gapsJson: JSON.stringify(result.gaps), unknownJson: JSON.stringify(result.unknown),
    hardBlocksJson: JSON.stringify(result.hardBlocks), criteriaJson: JSON.stringify(result.criteria),
  }});
  await prisma.statusHistory.create({ data: { jobId: job.id, toStatus: "NOVA", note: "Vaga cadastrada manualmente." } });
  redirect(`/vagas/${job.id}`);
}

export async function reassessJob(data: FormData) {
  const id = text(data, "jobId");
  const [{ profile, settings }, job] = await Promise.all([defaults(), prisma.job.findUniqueOrThrow({ where: { id } })]);
  const result = assessJob(job, profile, settings);
  await prisma.matchAssessment.upsert({
    where: { jobId: id },
    create: { jobId: id, score: result.score, category: result.category, coverage: result.coverage, explanation: result.explanation, matchedJson: JSON.stringify(result.matched), gapsJson: JSON.stringify(result.gaps), unknownJson: JSON.stringify(result.unknown), hardBlocksJson: JSON.stringify(result.hardBlocks), criteriaJson: JSON.stringify(result.criteria) },
    update: { score: result.score, category: result.category, coverage: result.coverage, explanation: result.explanation, matchedJson: JSON.stringify(result.matched), gapsJson: JSON.stringify(result.gaps), unknownJson: JSON.stringify(result.unknown), hardBlocksJson: JSON.stringify(result.hardBlocks), criteriaJson: JSON.stringify(result.criteria) },
  });
  revalidatePath(`/vagas/${id}`);
}

export async function adjustScore(data: FormData) {
  const id = text(data, "jobId");
  const score = Number(text(data, "score"));
  const reason = text(data, "reason");
  if (!Number.isInteger(score) || score < 0 || score > 100 || !reason) redirect(`/vagas/${id}?erro=ajuste`);
  await prisma.job.update({ where: { id }, data: { manualScore: score, manualScoreReason: reason } });
  revalidatePath(`/vagas/${id}`);
}

export async function transitionJob(data: FormData) {
  const id = text(data, "jobId");
  const to = text(data, "toStatus") as JobStatus;
  const note = optional(data, "note");
  const evidence = optional(data, "evidence");
  const confirmed = data.get("confirmedSent") === "on";
  const resumeVersionId = optional(data, "resumeVersionId");
  const job = await prisma.job.findUniqueOrThrow({ where: { id } });
  try { validateTransition(job.status, to, confirmed, evidence ?? undefined); }
  catch (error) { redirect(`/vagas/${id}?erro=${encodeURIComponent(error instanceof Error ? error.message : "Transição inválida")}`); }
  await prisma.$transaction([
    prisma.job.update({ where: { id }, data: { status: to } }),
    prisma.statusHistory.create({ data: { jobId: id, fromStatus: job.status, toStatus: to, note, evidence, confirmedSent: confirmed, resumeVersionId } }),
  ]);
  revalidatePath(`/vagas/${id}`);
  revalidatePath("/candidaturas");
}

export async function prepareApplication(data: FormData) {
  const jobId = text(data, "jobId");
  const requestedResumeId = optional(data, "resumeId");
  const [{ profile, settings }, job, resume] = await Promise.all([
    defaults(), prisma.job.findUniqueOrThrow({ where: { id: jobId } }),
    requestedResumeId
      ? prisma.resume.findUnique({ where: { id: requestedResumeId } })
      : prisma.resume.findFirst({ where: { isDefault: true, confirmed: true, storedPath: { not: null } } }),
  ]);
  const facts = parseJson<string[]>(profile.confirmedFactsJson, []);
  const prepared = buildDeterministicPreparation(job, facts, Boolean(resume?.confirmed));
  let output = { ...prepared, coverLetter: null as string | null };
  let aiProvider = "deterministic";
  if (settings.aiEnabled) {
    const month = new Date().toISOString().slice(0, 7);
    const used = settings.aiUsageMonth === month ? settings.aiRequestsThisMonth : 0;
    try {
      if (used >= settings.aiMonthlyLimit) throw new Error("Limite mensal de IA atingido.");
      const ai = await new OpenAiProvider().prepare({ job: JSON.stringify({ title: job.title, company: job.company, description: job.description, required: job.requiredJson }), confirmedFacts: facts });
      output = { opportunitySummary: ai.opportunitySummary, shortIntroduction: ai.shortIntroduction, coverLetter: ai.coverLetter, groundedClaims: ai.groundedClaims, pendingItems: [...ai.pendingItems, ...prepared.pendingItems.filter((item) => !ai.pendingItems.includes(item))] };
      aiProvider = "openai";
      await prisma.settings.update({ where: { id: 1 }, data: { aiUsageMonth: month, aiRequestsThisMonth: used + 1 } });
    } catch (error) {
      await prisma.execution.create({ data: { task: "openai-preparation", status: "failed", finishedAt: new Date(), errorMessage: (error instanceof Error ? error.message : "Falha externa").slice(0, 500) } });
    }
  }
  await prisma.applicationPreparation.create({ data: {
    jobId, resumeId: resume?.confirmed ? resume.id : null,
    opportunitySummary: output.opportunitySummary,
    shortIntroduction: output.shortIntroduction, coverLetter: output.coverLetter,
    pendingItemsJson: JSON.stringify(output.pendingItems), groundedClaimsJson: JSON.stringify(output.groundedClaims),
    proposedChangesJson: JSON.stringify(resume?.confirmed ? ["Priorizar fatos confirmados relacionados aos requisitos da vaga; nenhuma experiência nova foi adicionada."] : []),
    aiProvider,
  }});
  if (job.status === "APROVADA_PREPARAR") {
    await prisma.$transaction([
      prisma.job.update({ where: { id: jobId }, data: { status: "PREPARADA" } }),
      prisma.statusHistory.create({ data: { jobId, fromStatus: job.status, toStatus: "PREPARADA", note: "Materiais preparados para revisão humana." } }),
    ]);
  }
  revalidatePath(`/vagas/${jobId}`);
}

export async function saveAnswer(data: FormData) {
  const question = text(data, "question");
  const answer = text(data, "answer");
  if (!question || !answer) redirect("/respostas?erro=campos");
  await prisma.answerEntry.create({ data: { question, answer, sensitive: data.get("sensitive") === "on", confirmed: data.get("confirmed") === "on" } });
  revalidatePath("/respostas");
}

export async function confirmResume(data: FormData) {
  const id = text(data, "resumeId");
  await prisma.resume.update({ where: { id }, data: { confirmed: true } });
  revalidatePath("/curriculos");
}

export async function setDefaultResume(data: FormData) {
  const id = text(data, "resumeId");
  const resume = await prisma.resume.findUnique({ where: { id } });
  if (!resume?.confirmed || !resume.storedPath) redirect("/curriculos?erro=padrao");
  await prisma.$transaction([
    prisma.resume.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.resume.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/curriculos");
  revalidatePath("/vagas/[id]", "page");
  redirect("/curriculos?padrao=1");
}

export async function createResumeVersion(data: FormData) {
  const id = text(data, "resumeId");
  const orientation = text(data, "orientation") as ResumeOrientation;
  const source = await prisma.resume.findUniqueOrThrow({ where: { id } });
  if (!source.confirmed) redirect("/curriculos?erro=confirme");
  const labels: Record<ResumeOrientation, string> = { ORIGINAL: "Original", FULL_STACK: "Full-Stack", BACKEND_INTEGRACOES: "Backend e integrações", IA_AUTOMACAO: "IA e automação" };
  await prisma.resume.create({ data: {
    name: `${source.name} — ${labels[orientation]}`,
    extractedText: source.extractedText, confirmed: false, orientation, parentId: source.id,
    changesJson: JSON.stringify(["Cópia criada para reorganização manual; nenhum fato foi acrescentado."]),
  }});
  revalidatePath("/curriculos");
}

export async function saveSettings(data: FormData) {
  const weights = ["technologiesWeight", "seniorityWeight", "locationWeight", "responsibilitiesWeight", "languageWeight", "salaryWeight"] as const;
  const values = Object.fromEntries(weights.map((key) => [key, Number(text(data, key))]));
  if (Object.values(values).some((v) => !Number.isInteger(v) || v < 0) || Object.values(values).reduce((a, b) => a + b, 0) !== 100) redirect("/integracoes?erro=pesos");
  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, ...values }, update: { ...values, aiEnabled: data.get("aiEnabled") === "on", aiMonthlyLimit: Math.max(0, Number(text(data, "aiMonthlyLimit")) || 0) } });
  revalidatePath("/integracoes");
}

export async function saveGmailLabel(data: FormData) {
  await prisma.integration.update({ where: { provider: "gmail" }, data: { selectedFolder: text(data, "label") } });
  revalidatePath("/integracoes");
}

export async function saveDiscoverySettings(data: FormData) {
  const minScore = Number(text(data, "discoveryMinScore"));
  const dailyLimit = Number(text(data, "discoveryDailyLimit"));
  const queries = lines(data.get("discoveryQueries")).slice(0, 30);
  const allowedSources = ["LinkedIn", "Indeed", "Glassdoor"];
  const sources = allowedSources.filter((source) => data.getAll("discoverySources").includes(source));
  if (!Number.isInteger(minScore) || minScore < 0 || minScore > 100 || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100 || !queries.length || !sources.length) {
    redirect("/integracoes?erro=descoberta");
  }
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, discoveryEnabled: data.get("discoveryEnabled") === "on", discoveryMinScore: minScore, discoveryDailyLimit: dailyLimit, discoveryQueriesJson: JSON.stringify(queries), discoverySourcesJson: JSON.stringify(sources) },
    update: { discoveryEnabled: data.get("discoveryEnabled") === "on", discoveryMinScore: minScore, discoveryDailyLimit: dailyLimit, discoveryQueriesJson: JSON.stringify(queries), discoverySourcesJson: JSON.stringify(sources) },
  });
  revalidatePath("/integracoes");
  redirect("/integracoes?descoberta=salva");
}

export async function runDiscoveryNow() {
  let summary: Awaited<ReturnType<typeof runDiscoveryWithExecution>>;
  try {
    summary = await runDiscoveryWithExecution("manual-job-discovery");
  } catch (error) {
    redirect(`/integracoes?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha na descoberta de vagas.")}`);
  }
  redirect(`/vagas?descobertas=${summary.discovered}&fila=${summary.queued}&arquivadas=${summary.archived}`);
}

export async function startSemiAutomaticApplication(data: FormData) {
  const jobId = text(data, "jobId");
  const requestedResumeId = optional(data, "resumeId");
  const requestedPreparationId = optional(data, "preparationId");
  const activeSince = new Date(Date.now() - 2 * 60 * 1000);
  const activeRun = await prisma.applicationAutomation.findFirst({ where: { status: { in: ["QUEUED", "STARTING", "ACTIVE", "REVIEW_READY"] }, updatedAt: { gte: activeSince } } });
  if (activeRun) redirect(`/vagas/${jobId}?erro=${encodeURIComponent("Já existe uma sessão assistida aberta. Feche o navegador dela e tente novamente.")}`);
  const [job, resumes] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.resume.findMany({ where: { confirmed: true, storedPath: { not: null } } }),
  ]);
  if (!job?.url) redirect(`/vagas/${jobId}?erro=${encodeURIComponent("Informe a URL da candidatura antes de iniciar o assistente.")}`);
  if (!resumes.length) redirect(`/vagas/${jobId}?erro=${encodeURIComponent("Confirme um currículo com arquivo PDF ou DOCX antes de iniciar.")}`);

  const recommended = choosePreferredResume(resumes, job);
  const resume = requestedResumeId ? resumes.find((item) => item.id === requestedResumeId) : recommended;
  if (!resume) redirect(`/vagas/${jobId}?erro=${encodeURIComponent("O currículo selecionado não está disponível ou confirmado.")}`);

  const preparation = requestedPreparationId
    ? await prisma.applicationPreparation.findFirst({ where: { id: requestedPreparationId, jobId } })
    : await prisma.applicationPreparation.findFirst({ where: { jobId, OR: [{ resumeId: resume.id }, { resumeId: null }] }, orderBy: { createdAt: "desc" } });
  if (requestedPreparationId && !preparation) redirect(`/vagas/${jobId}?erro=${encodeURIComponent("A preparação selecionada não pertence a esta vaga.")}`);

  const run = await prisma.applicationAutomation.create({
    data: { jobId, resumeId: resume.id, preparationId: preparation?.id },
  });
  try {
    launchApplicationAssistant(run.id);
  } catch (error) {
    await prisma.applicationAutomation.update({
      where: { id: run.id },
      data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 500) : "Falha ao iniciar o navegador.", finishedAt: new Date() },
    });
    redirect(`/vagas/${jobId}?erro=${encodeURIComponent("Não foi possível abrir o navegador assistido.")}`);
  }
  revalidatePath(`/vagas/${jobId}`);
  redirect(`/vagas/${jobId}?assistente=${run.id}`);
}
