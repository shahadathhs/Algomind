/** The configured public host (from SITE_URL), or null when it is not set. */
function siteHost(): string | null {
  try {
    return process.env.SITE_URL ? new URL(process.env.SITE_URL).host : null;
  } catch {
    return null;
  }
}

/** Unsafe methods must come from this site: the Origin host has to match the site's own host. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  // The site's own host: the Host header the platform set for this request, or the configured
  // public address. A forwarded-host header is never trusted: a caller can claim anything there.
  return host === (req.headers.get("host") ?? new URL(req.url).host) || host === siteHost();
}
