export function buildDeterministicPreparation(job: { title: string; company: string; location?: string | null; description: string }, confirmedFacts: string[], hasConfirmedResume: boolean) {
  const facts = confirmedFacts.filter(Boolean).slice(0, 8);
  return {
    opportunitySummary: `${job.title} — ${job.company}${job.location ? `, ${job.location}` : ""}. ${job.description.slice(0, 500)}`,
    shortIntroduction: facts.length
      ? `Olá! Tenho interesse na oportunidade de ${job.title} na ${job.company}. ${facts.slice(0, 3).join(". ")}. Gostaria de conversar sobre como essa experiência pode contribuir para a posição.`
      : `Olá! Tenho interesse na oportunidade de ${job.title} na ${job.company}. Antes de enviar, complete e confirme os fatos profissionais no perfil.`,
    groundedClaims: facts,
    pendingItems: [
      ...(facts.length ? [] : ["Confirme fatos profissionais no perfil antes de usar a apresentação."]),
      ...(!hasConfirmedResume ? ["Selecione e confirme uma versão de currículo."] : []),
      "Revise salário, disponibilidade, autorização de trabalho e mudança de cidade quando aplicável.",
      "Revise a última tela e conclua o envio manualmente, inclusive quando usar o modo semiautomático.",
    ],
  };
}
