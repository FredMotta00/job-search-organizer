import { describe, expect, it } from "vitest";
import { validateTransition } from "@/lib/status";
describe("histórico de estados",()=>{it("aceita transição válida",()=>expect(()=>validateTransition("NOVA","EM_ANALISE")).not.toThrow());it("rejeita salto inválido",()=>expect(()=>validateTransition("NOVA","OFERTA")).toThrow());it("impede falso status enviada",()=>{expect(()=>validateTransition("AGUARDANDO_ACAO","ENVIADA")).toThrow(/confirmação explícita/);expect(()=>validateTransition("AGUARDANDO_ACAO","ENVIADA",true)).not.toThrow()})});
