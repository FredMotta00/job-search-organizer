import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { restoreBackup } from "@/lib/backup";
const MAX=2*1024*1024;
export async function POST(request:Request){try{const form=await request.formData();const file=form.get("backup");if(!(file instanceof File)||file.size>MAX)throw new Error("Backup inválido ou maior que 2 MB.");await restoreBackup(prisma,JSON.parse(await file.text()));return NextResponse.redirect(new URL("/integracoes",request.url),303)}catch(error){return NextResponse.redirect(new URL(`/integracoes?erro=${encodeURIComponent(error instanceof Error?error.message:"Falha ao restaurar")}`,request.url),303)}}
