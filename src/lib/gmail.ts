import { google, gmail_v1 } from "googleapis";
import { prisma } from "./db";
import { decryptJson } from "./crypto";
import { normalizeJobUrl, neutralizeUntrustedText } from "./security";

type StoredTokens = { access_token?: string | null; refresh_token?: string | null; scope?: string; token_type?: string | null; expiry_date?: number | null };

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function oauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) throw new Error("Credenciais OAuth do Gmail não configuradas.");
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

async function authorizedGmail() {
  const integration = await prisma.integration.findUnique({ where: { provider: "gmail" } });
  if (!integration?.encryptedTokens) throw new Error("Gmail não conectado.");
  const auth = oauthClient(); auth.setCredentials(decryptJson<StoredTokens>(integration.encryptedTokens));
  return { gmail: google.gmail({ version: "v1", auth }), integration };
}

export async function listGmailLabels() {
  const { gmail } = await authorizedGmail();
  const result = await gmail.users.labels.list({ userId: "me" });
  return (result.data.labels ?? []).filter((l) => l.id && l.name).map((l) => ({ id: l.id!, name: l.name! }));
}

function decodePart(part: gmail_v1.Schema$MessagePart): string {
  if (part.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  return (part.parts ?? []).map(decodePart).join("\n");
}

export async function importGmailAlerts() {
  const { gmail, integration } = await authorizedGmail();
  if (!integration.selectedFolder) throw new Error("Selecione um marcador do Gmail.");
  const list = await gmail.users.messages.list({ userId: "me", labelIds: [integration.selectedFolder], maxResults: 50 });
  let processed = 0;
  for (const item of list.data.messages ?? []) {
    if (!item.id || await prisma.job.findFirst({ where: { source: "Gmail", externalId: item.id } })) continue;
    const message = await gmail.users.messages.get({ userId: "me", id: item.id, format: "full" });
    const headers = Object.fromEntries((message.data.payload?.headers ?? []).map((h) => [h.name?.toLowerCase(), h.value]));
    const body = neutralizeUntrustedText(decodePart(message.data.payload ?? {}) || message.data.snippet || "");
    const urls = body.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
    let url: string | null = null;
    for (const candidate of urls) { try { url = normalizeJobUrl(candidate); if (url) break; } catch { /* ignora URL inválida */ } }
    if (url && await prisma.job.findFirst({ where: { normalizedUrl: url } })) continue;
    const company = headers.from?.split("<")[0]?.trim() || "Origem por confirmar";
    const title = headers.subject || "Alerta de vaga";
    const possibleDuplicate = Boolean(await prisma.job.findFirst({ where: { company, title, NOT: { source: "Gmail" } } }));
    await prisma.job.create({ data: {
      source: "Gmail", externalId: item.id, url, normalizedUrl: url,
      company, title,
      description: body, incomplete: body.length < 300, possibleDuplicate,
      fieldOriginsJson: JSON.stringify({ title: "assunto do e-mail", company: "remetente do e-mail", description: "corpo do e-mail", url: "link presente no e-mail", sourceMessageId: item.id }),
    }});
    processed++;
  }
  await prisma.integration.update({ where: { provider: "gmail" }, data: { lastSyncAt: new Date(), lastError: null } });
  return processed;
}
