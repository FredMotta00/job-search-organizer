import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { oauthClient } from "@/lib/gmail";

export async function GET(request: Request) {
  const url=new URL(request.url); const code=url.searchParams.get("code"); const state=url.searchParams.get("state"); const jar=await cookies(); const expected=jar.get("gmail_oauth_state")?.value;
  if(!code||!state||!expected||state!==expected) return NextResponse.redirect(new URL("/integracoes?erro=Estado%20OAuth%20inválido",request.url));
  try { const auth=oauthClient(); const {tokens}=await auth.getToken(code); await prisma.integration.upsert({where:{provider:"gmail"},create:{provider:"gmail",status:"connected",encryptedTokens:encryptJson(tokens)},update:{status:"connected",encryptedTokens:encryptJson(tokens),lastError:null}}); const response=NextResponse.redirect(new URL("/integracoes",request.url)); response.cookies.delete("gmail_oauth_state"); return response; }
  catch(error){return NextResponse.redirect(new URL(`/integracoes?erro=${encodeURIComponent(error instanceof Error?error.message:"Falha ao conectar Gmail")}`,request.url));}
}
