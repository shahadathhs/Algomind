// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  contrast,
  generateCss,
  generateGdscript,
  loadTokens,
  outputs,
  repoRoot,
} from "../scripts/lib.mjs";

const tokens = loadTokens();
const byName = Object.fromEntries(tokens.map((t) => [t.name, t]));
const HEX = /^#[0-9A-F]{6}$/;

test("every token has a unique kebab-case name and valid colors in both themes", () => {
  const names = tokens.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "token names must be unique");
  for (const t of tokens) {
    assert.match(t.name, /^[a-z]+(-[a-z]+)*$/, `${t.name} must be kebab-case`);
    assert.match(t.light, HEX, `${t.name} light`);
    assert.match(t.dark, HEX, `${t.name} dark`);
    assert.ok(t.use.length > 0, `${t.name} needs a description`);
  }
});

// Contrast requirements from docs/README_VISUAL_DESIGN.md, section 2.
const pairs = [
  // [foreground, background, minimum ratio, themes checked]
  ["ink", "ground", 7, ["light", "dark"]],
  ["ink", "floor", 7, ["light", "dark"]],
  ["on-ink", "ink", 7, ["light", "dark"]],
  ["on-signal", "signal", 7, ["light", "dark"]],
  ["mute", "ground", 4.5, ["light", "dark"]],
  ["mute", "strip", 4.5, ["light", "dark"]],
  // Yellow is a fill with ink on top; as foreground on the ground it is dark-theme only.
  ["signal", "ground", 4.5, ["dark"]],
];
for (const [fg, bg, min, themes] of pairs) {
  for (const theme of /** @type {("light" | "dark")[]} */ (themes)) {
    test(`contrast ${fg} on ${bg} (${theme}) is at least ${min}`, () => {
      const ratio = contrast(byName[String(fg)][theme], byName[String(bg)][theme]);
      assert.ok(ratio >= Number(min), `${fg}/${bg} ${theme} is ${ratio.toFixed(2)}`);
    });
  }
}

test("signal on the light ground stays out of text use (documented as fill only)", () => {
  const ratio = contrast(byName.signal.light, byName.ground.light);
  assert.ok(ratio < 3, "if this ever passes, update the visual-design doc rule");
});

test("the token table in the visual-design doc matches tokens.json", () => {
  const doc = readFileSync(join(repoRoot, "docs/README_VISUAL_DESIGN.md"), "utf8");
  const rows = [
    ...doc.matchAll(/^\|\s*`([a-z-]+)`\s*\|\s*`(#[0-9A-F]{6})`\s*\|\s*`(#[0-9A-F]{6})`\s*\|/gim),
  ];
  assert.equal(rows.length, tokens.length, "doc table must list every token");
  for (const [, name, light, dark] of rows) {
    assert.ok(byName[name], `doc lists unknown token ${name}`);
    assert.equal(light.toUpperCase(), byName[name].light, `${name} light differs in the doc`);
    assert.equal(dark.toUpperCase(), byName[name].dark, `${name} dark differs in the doc`);
  }
});

test("generated GDScript defines every token and an apply function", () => {
  const gd = generateGdscript(tokens);
  for (const t of tokens) {
    const upper = t.name.toUpperCase().replaceAll("-", "_");
    assert.ok(gd.includes(`static var ${upper}: Color`), `${upper} missing`);
    assert.ok(gd.includes(`"${t.name}": Color("${t.light}")`), `${t.name} light missing`);
    assert.ok(gd.includes(`"${t.name}": Color("${t.dark}")`), `${t.name} dark missing`);
  }
  assert.ok(gd.includes("static func apply(dark: bool) -> void:"));
});

test("generated CSS has light, system-dark, and forced-dark blocks", () => {
  const css = generateCss(tokens);
  assert.ok(css.includes(":root {"));
  assert.ok(css.includes("@media (prefers-color-scheme: dark)"));
  assert.ok(css.includes(':root:not([data-theme="light"])'));
  assert.ok(css.includes(':root[data-theme="dark"]'));
  for (const t of tokens) assert.ok(css.includes(`--${t.name}: ${t.light};`), `${t.name} missing`);
});

test("committed generated files are up to date", () => {
  const read = (/** @type {string} */ p) => readFileSync(join(repoRoot, p), "utf8");
  assert.equal(read(outputs.gd), generateGdscript(tokens), "run `pnpm tokens`");
  assert.equal(read(outputs.css), generateCss(tokens), "run `pnpm tokens`");
});
