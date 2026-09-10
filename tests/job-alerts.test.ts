import { describe, expect, it } from "vitest";
import { extractOfficialJobLinks, officialSourceFromSender, scoreDiscoveredJob } from "@/lib/job-alerts";

describe("alertas oficiais de vagas", () => {
  it("aceita somente domínios oficiais configurados", () => {
    expect(officialSourceFromSender("LinkedIn Jobs <jobalerts-noreply@linkedin.com>")).toBe("LinkedIn");
    expect(officialSourceFromSender("alert@indeedemail.com")).toBe("Indeed");
    expect(officialSourceFromSender("jobs@glassdoor.com")).toBe("Glassdoor");
    expect(officialSourceFromSender("LinkedIn falso <alert@phishing.example>")).toBeNull();
  });

  it("extrai e normaliza uma vaga do LinkedIn sem acessar a página", () => {
    const jobs = extractOfficialJobLinks({ source: "LinkedIn", subject: "Novas vagas", plain: "", html: '<a href="https://www.linkedin.com/comm/jobs/view/software-engineer-123456789/?trackingId=x">Software Engineer at Acme</a>' });
    expect(jobs).toEqual([{ source: "LinkedIn", externalId: "123456789", url: "https://www.linkedin.com/jobs/view/123456789", title: "Software Engineer at Acme" }]);
  });

  it("extrai links de Indeed e Glassdoor e ignora links institucionais", () => {
    const indeed = extractOfficialJobLinks({ source: "Indeed", subject: "Alerta", plain: "https://br.indeed.com/viewjob?jk=abcdef123456", html: '<a href="https://br.indeed.com/account">Conta</a>' });
    const glassdoor = extractOfficialJobLinks({ source: "Glassdoor", subject: "Alerta", plain: "", html: '<a href="https://www.glassdoor.com.br/job-listing/dev-full-stack-JV_IC123.htm?jobListingId=98765">Dev Full Stack Pleno</a>' });
    expect(indeed[0]).toMatchObject({ source: "Indeed", externalId: "abcdef123456" });
    expect(glassdoor[0]).toMatchObject({ source: "Glassdoor", externalId: "98765" });
  });

  it("prioriza pleno com tecnologias do perfil e penaliza júnior", () => {
    const base = { queries: ["desenvolvedor pleno"], technologies: ["TypeScript", "React", "Python"] };
    const pleno = scoreDiscoveredJob({ ...base, title: "Desenvolvedor Pleno", content: "TypeScript React" });
    const junior = scoreDiscoveredJob({ ...base, title: "Desenvolvedor Júnior", content: "TypeScript" });
    expect(pleno.score).toBeGreaterThanOrEqual(65);
    expect(junior.score).toBeLessThan(65);
  });
});
