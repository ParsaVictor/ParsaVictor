// Repo health check, run by CI on every push and pull request:
//   1. every script parses (node --check),
//   2. every committed SVG is well-formed XML — GitHub shows a broken image
//      for a single stray "&", which is exactly how a nav chip broke once,
//   3. every asset the README points at on main actually exists,
//   4. every in-page link (#anchor) matches a real heading.
//
//   node scripts/check.mjs

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLValidator } from "fast-xml-parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(root, p).replace(/\\/g, "/");

// 1. scripts parse
for (const f of walk(path.join(root, "scripts"), ".mjs")) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    errors.push(`${rel(f)}: syntax error\n${e.stderr}`);
  }
}

// 2. SVGs are well-formed
for (const f of walk(path.join(root, "assets"), ".svg")) {
  const res = XMLValidator.validate(readFileSync(f, "utf8"));
  if (res !== true) errors.push(`${rel(f)}:${res.err.line} invalid SVG — ${res.err.msg}`);
}

// 3. README assets on main exist
const readme = readFileSync(path.join(root, "README.md"), "utf8");
const MAIN = "https://raw.githubusercontent.com/ParsaVictor/ParsaVictor/main/";
for (const [, file] of readme.matchAll(new RegExp(`${MAIN.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^"')\\s]+)`, "g"))) {
  if (!existsSync(path.join(root, file))) errors.push(`README.md: missing asset ${file}`);
}

// 4. #anchors match headings, using GitHub's slug rules: lowercase, drop
//    everything but letters/digits/spaces/hyphens/variation selectors, spaces → "-".
const slug = (h) =>
  h
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-️]/gu, "")
    .replace(/\s/g, "-");
const anchors = new Set(
  [...readme.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, h]) => slug(h.replace(/<[^>]+>/g, "")))
);
for (const [, a] of readme.matchAll(/href="#([^"]+)"|\]\(#([^)]+)\)/g)) {
  if (a && !anchors.has(decodeURIComponent(a))) errors.push(`README.md: link #${a} has no matching heading`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n✗ ${errors.length} problem${errors.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log("✓ scripts parse, SVGs are valid, README assets and anchors resolve");
