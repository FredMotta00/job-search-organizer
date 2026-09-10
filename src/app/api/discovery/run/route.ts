import crypto from "node:crypto";
import { runDiscoveryWithExecution } from "@/lib/discovery";

export const runtime = "nodejs";

function validToken(request: Request) {
  const expected = process.env.LOCAL_AUTOMATION_TOKEN
    || (process.env.APP_ENCRYPTION_KEY ? crypto.createHash("sha256").update(`${process.env.APP_ENCRYPTION_KEY}:job-discovery`).digest("hex") : "");
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  if (!validToken(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return Response.json(await runDiscoveryWithExecution("python-job-discovery"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na descoberta de vagas.";
    return Response.json({ error: message }, { status: 500 });
  }
}
