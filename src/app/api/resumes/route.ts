import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { neutralizeUntrustedText } from "@/lib/security";
import { validateResumeUpload } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const file=form.get("file"); const name=String(form.get("name")??"").trim();
    if (!(file instanceof File) || !name) throw new Error("Arquivo e nome são obrigatórios.");
    const ext=validateResumeUpload(file);
    const buffer=Buffer.from(await file.arrayBuffer()); let extracted="";
    if(ext===".pdf") extracted=(await pdf(buffer)).text.trim(); else extracted=(await mammoth.extractRawText({buffer})).value.trim();
    const uploadDir=path.join(process.cwd(),"data","uploads"); await fs.mkdir(uploadDir,{recursive:true});
    const storedPath=path.join(uploadDir,`${crypto.randomUUID()}${ext}`); await fs.writeFile(storedPath,buffer,{flag:"wx"});
    await prisma.resume.create({data:{name,originalFileName:path.basename(file.name),mimeType:file.type||null,size:file.size,storedPath,extractedText:neutralizeUntrustedText(extracted),changesJson:JSON.stringify(extracted?[]:["PDF sem texto detectável; nenhuma extração foi inventada."])}});
    return NextResponse.redirect(new URL(extracted?"/curriculos":"/curriculos?erro=PDF%20sem%20texto%20detectável.%20Use%20OCR%20e%20importe%20novamente.",request.url),303);
  } catch(error) { return NextResponse.redirect(new URL(`/curriculos?erro=${encodeURIComponent(error instanceof Error?error.message:"Falha na importação")}`,request.url),303); }
}
