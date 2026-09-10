import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.applicationAutomation.findUnique({
    where: { id },
    select: { id: true, status: true, filledFieldsJson: true, pendingFieldsJson: true, lastError: true, startedAt: true, finishedAt: true, updatedAt: true },
  });
  if (!run) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  return NextResponse.json({
    ...run,
    filledFields: parseJson(run.filledFieldsJson, []),
    pendingFields: parseJson(run.pendingFieldsJson, []),
    filledFieldsJson: undefined,
    pendingFieldsJson: undefined,
  });
}
