import { google, gmail_v1 } from "googleapis";
import { prisma } from "./db";
import { decryptJson } from "./crypto";
import { normalizeJobUrl, neutralizeUntrustedText } from "./security";
import { officialSourceFromSender, type OfficialJobSource } from "./job-alerts";

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

function decodeMime(part: gmail_v1.Schema$MessagePart): { plain: string; html: string } {
  const value = part.body?.data ? Buffer.from(part.body.data, "base64url").toString("utf8") : "";
  const nested = (part.parts ?? []).map(decodeMime);
  return {
    plain: [part.mimeType === "text/plain" ? value : "", ...nested.map((item) => item.plain)].filter(Boolean).join("\n"),
    html: [part.mimeType === "text/html" ? value : "", ...nested.map((item) => item.html)].filter(Boolean).join("\n"),
  };
}

export type OfficialAlertMessage = {
  id: string;
  source: OfficialJobSource;
  subject: string;
  from: string;
  plain: string;
  html: string;
  snippet: string;
};

export async function listOfficialJobAlertMessages(maxResults = 100): Promise<OfficialAlertMessage[]> {
  const { gmail } = await authorizedGmail();
  const list = await gmail.users.messages.list({
    userId: "me",
    q: "newer_than:30d {from:(linkedin.com) from:(indeed.com) from:(indeedemail.com) from:(glassdoor.com)}",
    maxResults: Math.max(1, Math.min(100, maxResults)),
  });
  const messages: OfficialAlertMessage[] = [];
  for (const item of list.data.messages ?? []) {
    if (!item.id) continue;
    const message = await gmail.users.messages.get({ userId: "me", id: item.id, format: "full" });
    const headers = Object.fromEntries((message.data.payload?.headers ?? []).map((header) => [header.name?.toLowerCase(), header.value ?? ""]));
    const from = headers.from ?? "";
    const source = officialSourceFromSender(from);
    if (!source) continue;
    const decoded = decodeMime(message.data.payload ?? {});
    messages.push({
      id: item.id,
      source,
      subject: neutralizeUntrustedText(headers.subject || "Alerta de vaga").slice(0, 300),
      from,
      plain: neutralizeUntrustedText(decoded.plain).slice(0, 100_000),
      html: decoded.html.slice(0, 500_000),
      snippet: neutralizeUntrustedText(message.data.snippet || "").slice(0, 1_000),
    });
  }
  return messages;
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
