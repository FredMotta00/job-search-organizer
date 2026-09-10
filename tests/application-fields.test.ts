import { describe, expect, it } from "vitest";
import { choosePreferredResume, decideFieldValue, jobLooksEnglish, resumeLanguageScore } from "@/lib/application-fields";

const profile = {
  name: "Frederico Caires da Motta",
  email: "fredericocaires56@gmail.com",
  phone: "(19) 99447-5349",
  location: "Americana, SP",
  links: ["https://linkedin.com/in/fredericocairesdamotta"],
};

describe("preenchimento semiautomático", () => {
  it("preenche dados objetivos do perfil", () => {
    expect(decideFieldValue({ label: "Email address", type: "email", tag: "input", profile, answers: [] })).toMatchObject({ action: "fill", kind: "e-mail", value: profile.email });
    expect(decideFieldValue({ label: "First name", type: "text", tag: "input", profile, answers: [] })).toMatchObject({ action: "fill", value: "Frederico" });
    expect(decideFieldValue({ label: "Last name", type: "text", tag: "input", profile, answers: [] })).toMatchObject({ action: "fill", value: "Caires da Motta" });
  });

  it("não decide salário, autorização ou dados demográficos", () => {
    for (const label of ["Salary expectation", "Will you require visa sponsorship?", "Gender identity"]) {
      expect(decideFieldValue({ label, type: "text", tag: "input", profile, answers: [] })).toMatchObject({ action: "skip", reason: "Informação sensível ou decisória" });
    }
  });

  it("usa somente respostas confirmadas não sensíveis recebidas pela função", () => {
    const result = decideFieldValue({ label: "How did you hear about us?", type: "text", tag: "input", profile, answers: [{ question: "How did you hear about us?", answer: "LinkedIn", sensitive: false }] });
    expect(result).toMatchObject({ action: "fill", kind: "resposta confirmada", value: "LinkedIn" });
  });

  it("recomenda o currículo pela língua da vaga", () => {
    expect(jobLooksEnglish({ title: "Full Stack Software Engineer", description: "Responsibilities and requirements. Experience with TypeScript." })).toBe(true);
    const english = resumeLanguageScore({ name: "Frederico Resume EN", extractedText: "Professional summary Work experience Education Skills" }, true);
    const portuguese = resumeLanguageScore({ name: "Frederico Currículo", extractedText: "Resumo profissional Experiência profissional Formação Competências" }, true);
    expect(english).toBeGreaterThan(portuguese);
  });

  it("sempre prioriza o currículo marcado como padrão", () => {
    const resumes = [
      { id: "english", name: "Resume EN", extractedText: "Professional summary Work experience", isDefault: false },
      { id: "official", name: "Frederico Motta", extractedText: "Currículo oficial", isDefault: true },
    ];
    expect(choosePreferredResume(resumes, { title: "Software Engineer", description: "Requirements and responsibilities" })?.id).toBe("official");
  });
});
