import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const PATHS = ["/", "/levels", "/download", "/how-to-play", "/privacy", "/contact"];

// Sitemap entries must be absolute URLs. /admin is intentionally absent.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PATHS.map((path) => ({ url: path === "/" ? `${base}/` : `${base}${path}` }));
}
