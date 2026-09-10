import { describe, expect, it } from "vitest";
import { OpenAiProvider } from "@/lib/ai";
import { oauthClient } from "@/lib/gmail";
describe("credenciais externas",()=>{it("falha de forma compreensível sem credenciais",async()=>{const old=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;await expect(new OpenAiProvider().prepare({job:"x",confirmedFacts:[]})).rejects.toThrow("não configurada");if(old)process.env.OPENAI_API_KEY=old})});
describe("Gmail opcional",()=>{it("não inicia OAuth sem credenciais",()=>{const old=[process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,process.env.GOOGLE_REDIRECT_URI];delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET;delete process.env.GOOGLE_REDIRECT_URI;expect(()=>oauthClient()).toThrow("não configuradas");[process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,process.env.GOOGLE_REDIRECT_URI]=old})});
