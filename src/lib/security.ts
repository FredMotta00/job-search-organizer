const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "trk", "trackingId",
]);

export function normalizeJobUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("URL inválida.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use apenas URLs HTTP ou HTTPS.");
  if (url.username || url.password) throw new Error("URLs com credenciais não são permitidas.");
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) || key.startsWith("utm_")) url.searchParams.delete(key);
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

export function safeExternalUrl(raw: string | null | undefined): string | null {
  const normalized = normalizeJobUrl(raw);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("Endereços locais não são permitidos.");
  if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) {
    throw new Error("Endereços de rede privada não são permitidos.");
  }
  return normalized;
}

export function neutralizeUntrustedText(text: string): string {
  return text.replace(/\0/g, "").slice(0, 100_000);
}
