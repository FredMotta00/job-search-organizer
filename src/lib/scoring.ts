import type { Job, Profile, Settings } from "@prisma/client";
import { parseJson } from "./json";

type Criterion = { key: string; label: string; weight: number; known: boolean; ratio: number; matched: string[]; gaps: string[] };

const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const includesLoose = (haystack: string[], needle: string) => haystack.some((item) => norm(item).includes(norm(needle)) || norm(needle).includes(norm(item)));

export function assessJob(job: Job, profile: Profile, settings: Settings) {
  const tech = parseJson<string[]>(profile.technologiesJson, []);
  const required = parseJson<string[]>(job.requiredJson, []);
  const responsibilities = parseJson<string[]>(job.responsibilitiesJson, []);
  const experiences = parseJson<string[]>(profile.experiencesJson, []);
  const desiredSeniorities = parseJson<string[]>(profile.senioritiesJson, []);
  const workModes = parseJson<string[]>(profile.workModesJson, []);
  const regions = parseJson<string[]>(profile.regionsJson, []);
  const languages = parseJson<string[]>(profile.languagesJson, []);
  const jobLanguages = parseJson<string[]>(job.languagesJson, []);
  const contracts = parseJson<string[]>(profile.contractTypesJson, []);
  const excluded = parseJson<string[]>(profile.excludedCompanies, []);

  const techMatched = required.filter((item) => includesLoose(tech, item));
  const techGaps = required.filter((item) => !includesLoose(tech, item));
  const responsibilityMatched = responsibilities.filter((item) => includesLoose(experiences, item) || includesLoose(tech, item));
  const languageMatched = jobLanguages.filter((item) => includesLoose(languages, item));

  const criteria: Criterion[] = [
    { key: "technologies", label: "Tecnologias", weight: settings.technologiesWeight, known: required.length > 0, ratio: required.length ? techMatched.length / required.length : 0, matched: techMatched, gaps: techGaps },
    { key: "seniority", label: "Senioridade", weight: settings.seniorityWeight, known: Boolean(job.seniority), ratio: job.seniority && includesLoose(desiredSeniorities, job.seniority) ? 1 : 0, matched: job.seniority && includesLoose(desiredSeniorities, job.seniority) ? [job.seniority] : [], gaps: job.seniority && !includesLoose(desiredSeniorities, job.seniority) ? [job.seniority] : [] },
    { key: "location", label: "Localização e modelo", weight: settings.locationWeight, known: Boolean(job.workMode || job.location), ratio: (job.workMode && includesLoose(workModes, job.workMode)) || (job.location && includesLoose(regions, job.location)) ? 1 : 0, matched: [], gaps: [] },
    { key: "responsibilities", label: "Responsabilidades", weight: settings.responsibilitiesWeight, known: responsibilities.length > 0, ratio: responsibilities.length ? responsibilityMatched.length / responsibilities.length : 0, matched: responsibilityMatched, gaps: responsibilities.filter((item) => !responsibilityMatched.includes(item)) },
    { key: "language", label: "Idioma", weight: settings.languageWeight, known: jobLanguages.length > 0, ratio: jobLanguages.length ? languageMatched.length / jobLanguages.length : 0, matched: languageMatched, gaps: jobLanguages.filter((item) => !languageMatched.includes(item)) },
    { key: "salary", label: "Salário e contratação", weight: settings.salaryWeight, known: Boolean(job.contractType || job.salaryMin || job.salaryMax), ratio: job.contractType && contracts.length ? (includesLoose(contracts, job.contractType) ? 1 : 0) : 0.5, matched: [], gaps: [] },
  ];

  const knownWeight = criteria.filter((c) => c.known).reduce((sum, c) => sum + c.weight, 0);
  const score = knownWeight ? Math.round(criteria.filter((c) => c.known).reduce((sum, c) => sum + c.weight * c.ratio, 0) / knownWeight * 100) : 0;
  const coverage = Math.round(knownWeight / criteria.reduce((sum, c) => sum + c.weight, 0) * 100);
  const hardBlocks: string[] = [];
  if (excluded.some((item) => norm(item) === norm(job.company))) hardBlocks.push("Empresa está na lista de exclusão.");
  if (job.contractType && contracts.length && !includesLoose(contracts, job.contractType)) hardBlocks.push("Tipo de contratação incompatível com as preferências.");

  const matched = criteria.flatMap((c) => c.matched);
  const gaps = criteria.flatMap((c) => c.gaps);
  const unknown = criteria.filter((c) => !c.known).map((c) => c.label);
  const category = hardBlocks.length ? "eliminada" : score >= 80 ? "prioritária" : score >= 65 ? "revisar" : "baixa prioridade";
  return {
    score,
    category,
    coverage,
    explanation: hardBlocks.length ? "Há critérios eliminatórios. A nota informativa não supera esses bloqueios." : `Aderência ${category}, calculada somente sobre dados conhecidos.`,
    matched,
    gaps,
    unknown,
    hardBlocks,
    criteria,
  };
}
