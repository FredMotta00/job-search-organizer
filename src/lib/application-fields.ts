export type AssistantProfile = {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
};

export type ConfirmedAnswer = {
  question: string;
  answer: string;
  sensitive: boolean;
};

export type FieldDecision =
  | { action: "fill"; kind: string; value: string }
  | { action: "skip"; reason: string };

const sensitivePatterns = [
  "salary", "salario", "pretensao", "compensation", "visa", "sponsorship",
  "work authorization", "autorizacao de trabalho", "citizenship", "cidadania",
  "gender", "genero", "race", "raca", "ethnicity", "etnia", "disability",
  "deficiencia", "veteran", "veterano", "date of birth", "data de nascimento",
  "social security", "cpf", "rg", "criminal", "antecedentes", "marital",
  "estado civil", "religion", "religiao", "sexual orientation", "orientacao sexual",
];

export function normalizeFieldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isSensitiveField(label: string) {
  const normalized = normalizeFieldText(label);
  return sensitivePatterns.some((pattern) => normalized.includes(normalizeFieldText(pattern)));
}

function nameParts(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" "), full: parts.join(" ") };
}

function findLink(links: string[], type: "linkedin" | "github" | "website") {
  if (type === "linkedin") return links.find((link) => /linkedin/i.test(link)) ?? "";
  if (type === "github") return links.find((link) => /github/i.test(link)) ?? "";
  return links.find((link) => !/linkedin|github/i.test(link)) ?? links[0] ?? "";
}

function confirmedAnswer(label: string, answers: ConfirmedAnswer[]) {
  const normalized = normalizeFieldText(label);
  return answers.find((entry) => {
    if (entry.sensitive) return false;
    const question = normalizeFieldText(entry.question);
    return question.length >= 5 && (normalized.includes(question) || question.includes(normalized));
  });
}

export function decideFieldValue(input: {
  label: string;
  type: string;
  tag: string;
  profile: AssistantProfile;
  introduction?: string | null;
  coverLetter?: string | null;
  answers: ConfirmedAnswer[];
}): FieldDecision {
  const label = normalizeFieldText(input.label);
  const type = normalizeFieldText(input.type);
  const names = nameParts(input.profile.name);

  if (!label && !type) return { action: "skip", reason: "Campo sem identificação" };
  if (isSensitiveField(`${label} ${type}`)) return { action: "skip", reason: "Informação sensível ou decisória" };
  if (["password", "checkbox", "radio", "date", "number"].includes(type)) return { action: "skip", reason: "Campo exige decisão manual" };

  const saved = confirmedAnswer(label, input.answers);
  if (saved?.answer) return { action: "fill", kind: "resposta confirmada", value: saved.answer };

  if (type === "email" || /(^| )e mail( |$)|(^| )email( |$)/.test(label)) return { action: "fill", kind: "e-mail", value: input.profile.email };
  if (type === "tel" || /telefone|phone|mobile|celular|whatsapp/.test(label)) return { action: "fill", kind: "telefone", value: input.profile.phone };
  if (/first name|given name|primeiro nome|nome proprio/.test(label)) return { action: "fill", kind: "primeiro nome", value: names.first };
  if (/last name|family name|surname|sobrenome/.test(label)) return { action: "fill", kind: "sobrenome", value: names.last };
  if (/full name|your name|nome completo|^nome$|candidate name/.test(label)) return { action: "fill", kind: "nome completo", value: names.full };
  if (/linkedin/.test(label)) return { action: "fill", kind: "LinkedIn", value: findLink(input.profile.links, "linkedin") };
  if (/github/.test(label)) return { action: "fill", kind: "GitHub", value: findLink(input.profile.links, "github") };
  if (/portfolio|website|personal site|site pessoal/.test(label)) return { action: "fill", kind: "site", value: findLink(input.profile.links, "website") };
  if (/city|location|cidade|localizacao|address city/.test(label)) return { action: "fill", kind: "localização", value: input.profile.location };
  if (/cover letter|carta de apresentacao|motivation|motivacao/.test(label) && (input.coverLetter || input.introduction)) return { action: "fill", kind: "carta de apresentação", value: input.coverLetter || input.introduction || "" };
  if (/message|mensagem|additional information|informacoes adicionais|introduce yourself|apresente se/.test(label) && input.introduction) return { action: "fill", kind: "apresentação", value: input.introduction };

  return { action: "skip", reason: input.tag === "select" ? "Seleção exige decisão manual" : "Sem correspondência segura" };
}

export function jobLooksEnglish(job: { title: string; description: string; languagesJson?: string }) {
  const text = normalizeFieldText(`${job.title} ${job.description} ${job.languagesJson ?? ""}`);
  const englishSignals = ["requirements", "responsibilities", "about the role", "english", "software engineer", "developer", "experience with"];
  const portugueseSignals = ["requisitos", "responsabilidades", "sobre a vaga", "portugues", "desenvolvedor", "experiencia com"];
  return englishSignals.filter((signal) => text.includes(signal)).length > portugueseSignals.filter((signal) => text.includes(signal)).length;
}

export function resumeLanguageScore(resume: { name: string; originalFileName?: string | null; extractedText: string }, english: boolean) {
  const text = normalizeFieldText(`${resume.name} ${resume.originalFileName ?? ""} ${resume.extractedText.slice(0, 1200)}`);
  const englishSignals = ["resume en", "english", "professional summary", "work experience", "education", "skills"];
  const portugueseSignals = ["curriculo", "resumo profissional", "experiencia profissional", "formacao", "competencias"];
  const wanted = english ? englishSignals : portugueseSignals;
  const unwanted = english ? portugueseSignals : englishSignals;
  return wanted.filter((signal) => text.includes(signal)).length * 2 - unwanted.filter((signal) => text.includes(signal)).length;
}
