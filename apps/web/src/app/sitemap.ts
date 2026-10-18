import type { MetadataRoute } from "next";

// /admin is intentionally absent.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "/" }, { url: "/download" }];
}
