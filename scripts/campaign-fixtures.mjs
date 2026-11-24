#!/usr/bin/env node
// Writes one shared run fixture for every bundled campaign level that combines two or more board
// tools (guards, keys and doors, crates and docks, switches and gates, ice, belts, teleporters), so
// the TypeScript and the GDScript simulators are checked against each other on the boards the game
// ships. The hand-written fixtures cover one tool, or one pair, at a time.
//
//   node scripts/campaign-fixtures.mjs [out-dir]     default: packages/level-contract/fixtures/runs
//
// Each fixture is campaign-<slug>.json: the bundled level (apps/game/data/levels) with the program
// the exact solver finds and the reference simulator's result. The solver searches neither IF nor
// PROC, so a level it cannot solve is skipped and listed. Build the contract first
// (`pnpm --filter @algomind/level-contract build`); then format what was written
// (`pnpm exec prettier --write packages/level-contract/fixtures/runs`).
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  simulate,
  solve,
  validateLevel,
  validateProgram,
} from "../packages/level-contract/dist/index.js";

const levelsDir = fileURLToPath(new URL("../apps/game/data/levels/", import.meta.url));
const outDir = process.argv[2]
  ? `${resolve(process.argv[2])}/`
  : fileURLToPath(new URL("../packages/level-contract/fixtures/runs/", import.meta.url));
const TOOLS = ["patrols", "locks", "deliveries", "switches", "ice", "belts", "teleports"];

const written = [];
const skipped = [];
for (const file of (await readdir(levelsDir)).filter((name) => name.endsWith(".json"))) {
  const level = JSON.parse(await readFile(`${levelsDir}${file}`));
  const tools = TOOLS.filter((tool) => level[tool] !== undefined);
  if (tools.length < 2) continue;
  const best = validateLevel(level).ok ? solve(level) : null;
  if (!best || !best.fitsConstraints) {
    skipped.push(
      `${level.slug} (${tools.join(" + ")}): ${best ? "outside its limits" : "not solved by the exact search"}`,
    );
    continue;
  }
  const expected = simulate(level, best.program);
  if (expected.status !== "SUCCEEDED")
    throw new Error(`${level.slug}: the solver's program does not solve it`);
  const fixture = {
    description: `Campaign level "${level.title}" (${tools.join(" + ")}), solved by the exact search.`,
    level,
    program: best.program,
    programIssues: validateProgram(level, best.program).issues.map(({ path, code }) => ({
      path,
      code,
    })),
    expected,
  };
  const name = `campaign-${level.slug}.json`;
  await writeFile(`${outDir}${name}`, `${JSON.stringify(fixture, null, 2)}\n`);
  written.push(name);
}
for (const file of await readdir(outDir)) {
  if (file.startsWith("campaign-") && file.endsWith(".json") && !written.includes(file))
    await rm(`${outDir}${file}`);
}
console.log(`Wrote ${written.length} campaign run fixture(s) to ${outDir}`);
for (const line of skipped) console.log(`Skipped ${line}`);
