import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { GMAIL_SCOPE, oauthClient } from "@/lib/gmail";

export async function GET(request: Request) {
  try {
    const state=crypto.randomBytes(32).toString("hex"); const auth=oauthClient();
    const url=auth.generateAuthUrl({access_type:"offline",scope:[GMAIL_SCOPE],include_granted_scopes:true,state,prompt:"consent"});
    const response=NextResponse.redirect(url); response.cookies.set("gmail_oauth_state",state,{httpOnly:true,sameSite:"lax",secure:new URL(request.url).protocol==="https:",maxAge:600,path:"/"}); return response;
  } catch(error) { return NextResponse.redirect(new URL(`/integracoes?erro=${encodeURIComponent(error instanceof Error?error.message:"Falha no OAuth")}`,request.url)); }
}
