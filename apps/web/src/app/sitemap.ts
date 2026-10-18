import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Sitemap entries must be absolute URLs. /admin is intentionally absent.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [{ url: `${base}/` }, { url: `${base}/download` }];
}
