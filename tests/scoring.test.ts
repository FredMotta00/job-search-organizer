import { describe, expect, it } from "vitest";
import { assessJob } from "@/lib/scoring";

const profile = { technologiesJson:'["TypeScript","SQL"]', experiencesJson:'["APIs"]', senioritiesJson:'["Sênior"]', workModesJson:'["Remoto"]', regionsJson:'["Brasil"]', languagesJson:'["Inglês"]', contractTypesJson:'["CLT"]', excludedCompanies:'[]' };
const settings = { technologiesWeight:30,seniorityWeight:20,locationWeight:15,responsibilitiesWeight:15,languageWeight:10,salaryWeight:10 };
const job = { requiredJson:'["TypeScript","Rust"]',desiredJson:'["Kubernetes"]',responsibilitiesJson:'["APIs"]',languagesJson:'["Inglês"]',seniority:"Sênior",workMode:"Remoto",location:"Brasil",contractType:"CLT",salaryMin:null,salaryMax:null,company:"Empresa" };

describe("pontuação determinística",()=>{
  it("não trata dado ausente como descumprido",()=>{const r=assessJob({...job,requiredJson:"[]",seniority:null,workMode:null,location:null,contractType:null,languagesJson:"[]",responsibilitiesJson:"[]"} as never,profile as never,settings as never);expect(r.score).toBe(0);expect(r.coverage).toBe(0);expect(r.unknown).toContain("Tecnologias")});
  it("separa obrigatório de desejável",()=>{const r=assessJob(job as never,profile as never,settings as never);expect(r.gaps).toContain("Rust");expect(r.gaps).not.toContain("Kubernetes");expect(r.matched).toContain("TypeScript")});
  it("aplica critério eliminatório sem apagar a nota",()=>{const r=assessJob({...job,company:"Bloqueada"} as never,{...profile,excludedCompanies:'["Bloqueada"]'} as never,settings as never);expect(r.hardBlocks).toHaveLength(1);expect(r.category).toBe("eliminada");expect(r.score).toBeGreaterThan(0)});
});
