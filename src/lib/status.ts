import { JobStatus } from "@prisma/client";

export const STATUS_LABELS: Record<JobStatus, string> = {
  NOVA: "Nova",
  EM_ANALISE: "Em análise",
  APROVADA_PREPARAR: "Aprovada para preparar",
  PREPARADA: "Preparada",
  AGUARDANDO_ACAO: "Aguardando ação",
  ENVIADA: "Enviada",
  EM_PROCESSO: "Em processo",
  ENTREVISTA: "Entrevista",
  OFERTA: "Oferta",
  REJEITADA: "Rejeitada",
  ARQUIVADA: "Arquivada",
  RETIRADA: "Retirada",
};

const allowed: Record<JobStatus, JobStatus[]> = {
  NOVA: ["EM_ANALISE", "ARQUIVADA"],
  EM_ANALISE: ["APROVADA_PREPARAR", "ARQUIVADA", "RETIRADA"],
  APROVADA_PREPARAR: ["PREPARADA", "EM_ANALISE", "RETIRADA"],
  PREPARADA: ["AGUARDANDO_ACAO", "APROVADA_PREPARAR", "RETIRADA"],
  AGUARDANDO_ACAO: ["ENVIADA", "PREPARADA", "RETIRADA"],
  ENVIADA: ["EM_PROCESSO", "ENTREVISTA", "OFERTA", "REJEITADA", "RETIRADA"],
  EM_PROCESSO: ["ENTREVISTA", "OFERTA", "REJEITADA", "RETIRADA"],
  ENTREVISTA: ["EM_PROCESSO", "OFERTA", "REJEITADA", "RETIRADA"],
  OFERTA: ["ARQUIVADA", "RETIRADA"],
  REJEITADA: ["ARQUIVADA"],
  ARQUIVADA: ["NOVA", "EM_ANALISE"],
  RETIRADA: ["ARQUIVADA"],
};

export function validateTransition(from: JobStatus, to: JobStatus, confirmedSent = false, evidence?: string) {
  if (!allowed[from].includes(to)) throw new Error(`Transição inválida: ${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}.`);
  if (to === "ENVIADA" && !confirmedSent && !evidence?.trim()) {
    throw new Error("O status Enviada exige confirmação explícita ou evidência verificável.");
  }
}

export function allowedTransitions(status: JobStatus) {
  return allowed[status];
}
