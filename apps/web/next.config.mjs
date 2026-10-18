import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Plain JS on purpose: Next 16.2.11+ supports TypeScript 7, and the config stays trivial.
// `standalone` output keeps the Docker image small; the tracing root is the monorepo root
// so workspace packages are included.
/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(here, "..", ".."),
  poweredByHeader: false,
};

export default nextConfig;
