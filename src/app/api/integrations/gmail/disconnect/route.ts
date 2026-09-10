import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export async function POST(request:Request){await prisma.integration.deleteMany({where:{provider:"gmail"}});return NextResponse.redirect(new URL("/integracoes",request.url),303)}
