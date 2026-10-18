import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Nest needs decorator metadata, which esbuild (Vitest's default) does not emit; SWC does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
