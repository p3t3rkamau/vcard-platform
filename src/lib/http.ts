/** Shared HTTP/URL helpers (previously copy-pasted across routes and pages). */

const BOT_PATTERN = /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|curl|wget|headless/i;

/** True for crawlers and link-preview fetchers, which should not inflate analytics. */
export function isBotUserAgent(userAgent: string | null | undefined) {
  return BOT_PATTERN.test(userAgent || "");
}

/** Returns a normalized http(s) URL, or null for anything else (javascript:, data:, garbage). */
export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Keeps digits and a leading "+" so the value is safe and dialable in tel: links. */
export function dialableNumber(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? (trimmed.startsWith("+") ? "+" : "") + digits : "";
}

/** wa.me link for a WhatsApp number, or null if the number has too few digits. */
export function whatsappLink(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15 ? "https://wa.me/" + digits : null;
}

export function countryFromHeaders(headers: Headers) {
  const country = headers.get("x-vercel-ip-country");
  return country && /^[A-Z]{2}$/.test(country) ? country : null;
}

export function referrerDomainFromHeaders(headers: Headers) {
  const referrer = headers.get("referer");
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.slice(0, 190);
  } catch {
    return null;
  }
}

export function appBaseUrl() {
  // On Vercel, always derive the canonical public origin from Vercel's
  // current project domains. Do not let a stale NEXT_PUBLIC_APP_URL win.
  if (process.env.VERCEL) {
    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const deploymentHost = process.env.VERCEL_URL;
    const host = process.env.VERCEL_ENV === "production"
      ? productionHost || deploymentHost
      : productionHost || deploymentHost;
    if (host) return "https://" + host.replace(/^https?:\\/\\//, "").replace(/\\/$/, "");
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (configured || "http://localhost:3000").replace(/\\/$/, "");
}
