import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assessJob } from "./scoring";
import { buildDeterministicPreparation } from "./preparation";
import { parseJson } from "./json";
import { neutralizeUntrustedText, normalizeJobUrl } from "./security";
import { extractOfficialJobLinks, htmlToText, normalizeDiscoveryText, scoreDiscoveredJob, type OfficialJobSource } from "./job-alerts";
import { listOfficialJobAlertMessages } from "./gmail";

export type DiscoverySummary = {
  discovered: number;
  queued: number;
  archived: number;
  duplicates: number;
  ignoredSources: number;
  bySource: Record<OfficialJobSource, number>;
};

export async function runDiscoveryWithExecution(task = "job-discovery") {
  const execution = await prisma.execution.create({ data: { task, status: "running" } });
  try {
    const summary = await runScheduledDiscovery();
    await prisma.execution.update({ where: { id: execution.id }, data: { status: "success", processed: summary.discovered, finishedAt: new Date() } });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na descoberta de vagas.";
    await prisma.execution.update({ where: { id: execution.id }, data: { status: "failed", errorMessage: message.slice(0, 500), finishedAt: new Date() } });
    throw error;
  }
}

function inferSeniority(text: string) {
  if (/\b(pleno|mid[- ]?level|intermediate)\b/i.test(text)) return "Pleno";
  if (/\b(junior|júnior|trainee|intern|estágio)\b/i.test(text)) return "Júnior";
  if (/\b(senior|sênior|staff|principal|lead)\b/i.test(text)) return "Sênior";
  return null;
}

function inferWorkMode(text: string) {
  if (/\b(remote|remoto|work from home|home office)\b/i.test(text)) return "Remoto";
  if (/\b(hybrid|híbrido|hibrido)\b/i.test(text)) return "Híbrido";
  if (/\b(on[- ]?site|presencial)\b/i.test(text)) return "Presencial";
  return null;
}

function splitTitleAndCompany(rawTitle: string, source: OfficialJobSource) {
  const cleaned = rawTitle.replace(/\s+/g, " ").trim();
  for (const pattern of [/^(.+?)\s+at\s+(.+)$/i, /^(.+?)\s+(?:na|no)\s+(.+)$/i, /^(.+?)\s+[–—|]\s+(.+)$/]) {
    const match = cleaned.match(pattern);
    if (match && match[1].length >= 3 && match[2].length >= 2) return { title: match[1].trim(), company: match[2].trim() };
  }
  return { title: cleaned || "Vaga de desenvolvimento", company: `Empresa por confirmar (${source})` };
}

function startOfLocalDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function runScheduledDiscovery(): Promise<DiscoverySummary> {
  const [settings, profile, defaultResume] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.profile.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.resume.findFirst({ where: { isDefault: true, confirmed: true, storedPath: { not: null } } }),
  ]);
  const summary: DiscoverySummary = { discovered: 0, queued: 0, archived: 0, duplicates: 0, ignoredSources: 0, bySource: { LinkedIn: 0, Indeed: 0, Glassdoor: 0 } };
  if (!settings.discoveryEnabled) return summary;

  const sources = new Set(parseJson<OfficialJobSource[]>(settings.discoverySourcesJson, ["LinkedIn", "Indeed", "Glassdoor"]));
  const queries = parseJson<string[]>(settings.discoveryQueriesJson, []);
  const technologies = parseJson<string[]>(profile.technologiesJson, []);
  const preferredSeniorities = parseJson<string[]>(profile.senioritiesJson, []).map(normalizeDiscoveryText);
  const preferredWorkModes = parseJson<string[]>(profile.workModesJson, []).map(normalizeDiscoveryText);
  const preferredRegions = parseJson<string[]>(profile.regionsJson, []);
  const excludedCompanies = parseJson<string[]>(profile.excludedCompanies, []);
  const confirmedFacts = parseJson<string[]>(profile.confirmedFactsJson, []);
  const alreadyToday = await prisma.job.count({ where: { source: { in: ["LinkedIn", "Indeed", "Glassdoor"] }, importedAt: { gte: startOfLocalDay() } } });
  let remaining = Math.max(0, settings.discoveryDailyLimit - alreadyToday);
  if (!remaining) return summary;

  const messages = await listOfficialJobAlertMessages(Math.min(100, remaining * 5));
  for (const message of messages) {
    if (!sources.has(message.source)) { summary.ignoredSources += 1; continue; }
    const content = neutralizeUntrustedText(`${message.plain}\n${htmlToText(message.html)}\n${message.snippet}`).slice(0, 100_000);
    for (const candidate of extractOfficialJobLinks({ ...message, source: message.source })) {
      if (!remaining) break;
      const normalizedUrl = normalizeJobUrl(candidate.url);
      const duplicate = await prisma.job.findFirst({ where: { OR: [{ source: candidate.source, externalId: candidate.externalId }, { normalizedUrl }] } });
      if (duplicate) { summary.duplicates += 1; continue; }

      const relevance = scoreDiscoveredJob({ title: candidate.title, content, queries, technologies });
      const { title, company } = splitTitleAndCompany(candidate.title, candidate.source);
      const seniority = inferSeniority(`${title} ${content}`);
      const workMode = inferWorkMode(content);
      const location = preferredRegions.find((region) => content.includes(region) || normalizeDiscoveryText(content).includes(normalizeDiscoveryText(region))) ?? null;
      const blockedCompany = excludedCompanies.find((item) => company !== `Empresa por confirmar (${candidate.source})` && normalizeDiscoveryText(company).includes(normalizeDiscoveryText(item)));
      const seniorityMismatch = Boolean(seniority && preferredSeniorities.length && !preferredSeniorities.some((item) => normalizeDiscoveryText(seniority).includes(item) || item.includes(normalizeDiscoveryText(seniority))));
      const workModeMismatch = Boolean(workMode && preferredWorkModes.length && !preferredWorkModes.some((item) => normalizeDiscoveryText(workMode).includes(item) || item.includes(normalizeDiscoveryText(workMode))));
      if (location) { relevance.score = Math.min(100, relevance.score + 5); relevance.reasons.push(`região preferida identificada: ${location}`); }
      if (blockedCompany) relevance.reasons.push(`empresa bloqueada no perfil: ${blockedCompany}`);
      if (seniorityMismatch) relevance.reasons.push(`senioridade fora das preferências do perfil: ${seniority}`);
      if (workModeMismatch) relevance.reasons.push(`modelo de trabalho fora das preferências do perfil: ${workMode}`);
      const approved = relevance.score >= settings.discoveryMinScore && !blockedCompany && !seniorityMismatch && !workModeMismatch;
      try {
        const job = await prisma.job.create({ data: {
          source: candidate.source,
          externalId: candidate.externalId,
          url: candidate.url,
          normalizedUrl,
          company,
          title,
          description: content,
          requiredJson: JSON.stringify(relevance.matchedTechnologies),
          seniority,
          workMode,
          location,
          incomplete: true,
          discoveryScore: relevance.score,
          discoveryReason: relevance.reasons.join("; ") || "Alerta oficial sem sinais suficientes para priorização.",
          fieldOriginsJson: JSON.stringify({
            source: "alerta oficial por e-mail",
            sourceMessageId: message.id,
            title: "texto do link no alerta",
            description: "conteúdo do alerta; a página da vaga não foi coletada",
          }),
          status: approved ? "AGUARDANDO_ACAO" : "ARQUIVADA",
        } });
        const assessment = assessJob(job, profile, settings);
        await prisma.matchAssessment.create({ data: {
          jobId: job.id,
          score: assessment.score,
          category: assessment.category,
          coverage: assessment.coverage,
          explanation: assessment.explanation,
          matchedJson: JSON.stringify(assessment.matched),
          gapsJson: JSON.stringify(assessment.gaps),
          unknownJson: JSON.stringify(assessment.unknown),
          hardBlocksJson: JSON.stringify(assessment.hardBlocks),
          criteriaJson: JSON.stringify(assessment.criteria),
        } });
        if (approved) {
          const preparation = buildDeterministicPreparation(job, confirmedFacts, Boolean(defaultResume));
          await prisma.applicationPreparation.create({ data: {
            jobId: job.id,
            resumeId: defaultResume?.id,
            opportunitySummary: preparation.opportunitySummary,
            shortIntroduction: preparation.shortIntroduction,
            pendingItemsJson: JSON.stringify(preparation.pendingItems),
            groundedClaimsJson: JSON.stringify(preparation.groundedClaims),
            proposedChangesJson: JSON.stringify(defaultResume ? ["Currículo padrão selecionado automaticamente; nenhum fato foi acrescentado."] : []),
          } });
        }
        await prisma.statusHistory.create({ data: {
          jobId: job.id,
          toStatus: approved ? "AGUARDANDO_ACAO" : "ARQUIVADA",
          note: approved
            ? `Descoberta automaticamente em alerta oficial; relevância ${relevance.score}/100. Preparada para revisão antes do preenchimento.`
            : `Descoberta automaticamente e arquivada; relevância ${relevance.score}/100 abaixo do mínimo ${settings.discoveryMinScore}.`,
        } });
        summary.discovered += 1;
        summary.bySource[candidate.source] += 1;
        if (approved) summary.queued += 1; else summary.archived += 1;
        remaining -= 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") summary.duplicates += 1;
        else throw error;
      }
    }
    if (!remaining) break;
  }
  await prisma.integration.updateMany({ where: { provider: "gmail" }, data: { lastSyncAt: new Date(), lastError: null } });
  return summary;
}
