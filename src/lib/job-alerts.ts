export type OfficialJobSource = "LinkedIn" | "Indeed" | "Glassdoor";

export type JobAlertCandidate = {
  source: OfficialJobSource;
  externalId: string;
  url: string;
  title: string;
};

const genericLinkText = /^(ver|view|abrir|open|apply|candidatar|candidate-se|see job|ver vaga|detalhes|details|learn more)$/i;

export function normalizeDiscoveryText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function htmlToText(html: string) {
  return decodeHtmlEntities(html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function officialSourceFromSender(sender: string): OfficialJobSource | null {
  const email = (sender.match(/<([^>]+)>/)?.[1] ?? sender).trim().toLowerCase();
  const domain = email.split("@").pop() ?? "";
  if (domain === "linkedin.com" || domain.endsWith(".linkedin.com")) return "LinkedIn";
  if (domain === "indeed.com" || domain.endsWith(".indeed.com") || domain === "indeedemail.com" || domain.endsWith(".indeedemail.com")) return "Indeed";
  if (domain === "glassdoor.com" || domain.endsWith(".glassdoor.com")) return "Glassdoor";
  return null;
}

function unwrapUrl(raw: string) {
  let current = decodeHtmlEntities(raw).replace(/[)>.,]+$/, "");
  for (let depth = 0; depth < 3; depth += 1) {
    try {
      const parsed = new URL(current);
      const nested = ["url", "u", "q", "dest", "destination", "redirect"].map((key) => parsed.searchParams.get(key)).find((value) => value?.startsWith("http"));
      if (!nested) return parsed;
      current = nested;
    } catch {
      return null;
    }
  }
  try { return new URL(current); } catch { return null; }
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function classifyJobUrl(raw: string, expectedSource: OfficialJobSource): Omit<JobAlertCandidate, "title"> | null {
  const url = unwrapUrl(raw);
  if (!url || !["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (expectedSource === "LinkedIn" && (host === "linkedin.com" || host.endsWith(".linkedin.com"))) {
    const match = url.pathname.match(/\/jobs\/view\/(?:[^/?]*-)?(\d+)/i);
    const id = match?.[1] ?? url.searchParams.get("currentJobId");
    if (!id) return null;
    return { source: "LinkedIn", externalId: id, url: `https://www.linkedin.com/jobs/view/${id}` };
  }

  if (expectedSource === "Indeed" && (host === "indeed.com" || host.endsWith(".indeed.com"))) {
    const id = url.searchParams.get("jk") ?? url.searchParams.get("vjk") ?? url.searchParams.get("jobKey");
    if (!id || !/^[a-z0-9_-]{6,}$/i.test(id)) return null;
    return { source: "Indeed", externalId: id, url: `https://www.indeed.com/viewjob?jk=${encodeURIComponent(id)}` };
  }

  if (expectedSource === "Glassdoor" && /(^|\.)glassdoor\.[a-z.]+$/i.test(host)) {
    if (!/\/job-listing\/|\/partner\/jobListing/i.test(url.pathname)) return null;
    const id = url.searchParams.get("jobListingId") ?? url.searchParams.get("jl") ?? stableId(`${host}${url.pathname}`);
    url.hash = "";
    return { source: "Glassdoor", externalId: id, url: url.toString() };
  }
  return null;
}

function cleanTitle(value: string, fallback: string) {
  const title = htmlToText(value).replace(/\s+/g, " ").trim();
  return !title || genericLinkText.test(title) || title.length > 180 ? fallback : title;
}

export function extractOfficialJobLinks(input: { html: string; plain: string; subject: string; source: OfficialJobSource }) {
  const candidates: JobAlertCandidate[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of input.html.matchAll(anchorPattern)) {
    const classified = classifyJobUrl(match[1], input.source);
    if (!classified || seen.has(`${classified.source}:${classified.externalId}`)) continue;
    seen.add(`${classified.source}:${classified.externalId}`);
    candidates.push({ ...classified, title: cleanTitle(match[2], input.subject) });
  }
  for (const raw of input.plain.match(/https?:\/\/[^\s<>"')]+/g) ?? []) {
    const classified = classifyJobUrl(raw, input.source);
    if (!classified || seen.has(`${classified.source}:${classified.externalId}`)) continue;
    seen.add(`${classified.source}:${classified.externalId}`);
    candidates.push({ ...classified, title: input.subject });
  }
  return candidates;
}

export function scoreDiscoveredJob(input: { title: string; content: string; queries: string[]; technologies: string[] }) {
  const title = normalizeDiscoveryText(input.title);
  const text = normalizeDiscoveryText(`${input.title} ${input.content}`);
  const reasons: string[] = [];
  let score = 0;
  const titleQuery = input.queries.find((item) => title.includes(normalizeDiscoveryText(item)));
  const contentQuery = input.queries.find((item) => text.includes(normalizeDiscoveryText(item)));
  if (titleQuery) { score += 50; reasons.push(`título corresponde à busca “${titleQuery}”`); }
  else if (/developer|desenvolvedor|software engineer|engenheiro de software/.test(title)) { score += 35; reasons.push("cargo de desenvolvimento identificado no título"); }
  else if (contentQuery) { score += 20; reasons.push(`alerta corresponde à busca “${contentQuery}”`); }

  if (/\bpleno\b|\bmid level\b|\bmidlevel\b|\bintermediate\b/.test(title)) { score += 20; reasons.push("senioridade plena identificada no título"); }
  if (/\bjunior\b|\btrainee\b|\bintern\b|\bestagio\b/.test(title)) { score -= 40; reasons.push("senioridade inicial identificada no título"); }
  if (/\bsenior\b|\bstaff\b|\bprincipal\b|\blead\b/.test(title)) { score -= 30; reasons.push("senioridade acima do alvo identificada no título"); }

  const matchedTechnologies = input.technologies.filter((technology) => {
    const normalized = normalizeDiscoveryText(technology);
    return normalized.length >= 2 && text.includes(normalized);
  });
  if (matchedTechnologies.length) {
    score += Math.min(30, matchedTechnologies.length * 6);
    reasons.push(`${matchedTechnologies.length} tecnologia(s) do perfil encontrada(s)`);
  }
  return { score: Math.max(0, Math.min(100, score)), reasons, matchedTechnologies };
}
