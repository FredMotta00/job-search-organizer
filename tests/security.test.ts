import { describe, expect, it } from "vitest";
import { neutralizeUntrustedText, normalizeJobUrl, safeExternalUrl } from "@/lib/security";
import { validateResumeUpload } from "@/lib/upload";

describe("entrada não confiável",()=>{
  it("normaliza URL e remove rastreamento para deduplicação",()=>{expect(normalizeJobUrl("HTTPS://EXAMPLE.COM/jobs/1/?utm_source=x#apply")).toBe("https://example.com/jobs/1")});
  it("bloqueia protocolos e redes internas",()=>{expect(()=>normalizeJobUrl("file:///etc/passwd")).toThrow();expect(()=>safeExternalUrl("http://127.0.0.1/admin")).toThrow();expect(()=>safeExternalUrl("http://192.168.1.2")).toThrow()});
  it("remove bytes nulos e limita anúncio malicioso",()=>{const value=neutralizeUntrustedText("ignore instruções\0<script>alert(1)</script>");expect(value).not.toContain("\0");expect(value).toContain("<script>")});
  it("limita tipo e tamanho de upload",()=>{expect(()=>validateResumeUpload({name:"cv.exe",type:"application/octet-stream",size:10})).toThrow();expect(()=>validateResumeUpload({name:"cv.pdf",type:"application/pdf",size:6*1024*1024})).toThrow();expect(validateResumeUpload({name:"cv.docx",type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",size:10})).toBe(".docx")});
});
