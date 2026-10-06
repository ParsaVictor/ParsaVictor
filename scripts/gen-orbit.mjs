// "Stack orbit" — the tools I actually use as real brand marks travelling on
// three tilted orbits around a core, with depth: items swing large and bright
// past the front, small and dim behind, and the core occludes whatever passes
// behind it. Every icon stays upright (no rotating text like the old orbit).
//
// Pure SMIL (animateMotion + synced opacity/scale), so it plays inside a
// GitHub <img>. Deterministic output.
//
//   node scripts/gen-orbit.mjs

import { writeFileSync } from "node:fs";
import { C, esc } from "./lib/gh.mjs";
import { W, defs, baseStyle, frame } from "./lib/card.mjs";
import { icon, visibleHex, glyph } from "./lib/icons.mjs";

const H = 560;
const CX = W / 2;
const CY = 318;
const TILT = (-9 * Math.PI) / 180;

// Inner → outer: what I write in, what I build with, how it ships.
const RINGS = [
  { name: "Languages", color: C.gold, rx: 175, ry: 62, dur: 22, dir: 1,
    items: ["python", "cplusplus", "openjdk", "sqlite"] },
  { name: "AI & Vision", color: C.coral, rx: 290, ry: 104, dur: 34, dir: -1,
    items: ["pytorch", "tensorflow", "opencv", "scikitlearn", "huggingface", "keras"] },
  { name: "Ship & Deploy", color: C.red, rx: 395, ry: 142, dur: 48, dir: 1,
    items: ["nvidia", "docker", "fastapi", "githubactions", "git", "linux", "streamlit", "numpy"] },
];

const STEPS = 48; // sampled points per orbit — smooth enough, small file

// Point on a tilted ellipse at angle a (a = π/2 is the front, nearest us).
function at(ring, a) {
  const x = ring.rx * Math.cos(a);
  const y = ring.ry * Math.sin(a);
  return [CX + x * Math.cos(TILT) - y * Math.sin(TILT), CY + x * Math.sin(TILT) + y * Math.cos(TILT)];
}

const f = (n) => n.toFixed(1);

let orbits = "";
let items = "";
RINGS.forEach((ring, ri) => {
  // The ring itself: a faint full ellipse plus a flowing dashed highlight.
  const d =
    Array.from({ length: 97 }, (_, k) => {
      const [x, y] = at(ring, (k / 96) * 2 * Math.PI);
      return `${k ? "L" : "M"}${f(x)} ${f(y)}`;
    }).join(" ") + " Z";
  orbits += `
  <path d="${d}" fill="none" stroke="${ring.color}" stroke-opacity="0.18" stroke-width="1.2" />
  <path d="${d}" fill="none" stroke="${ring.color}" stroke-opacity="0.55" stroke-width="1.6" stroke-dasharray="2 14" class="flow${ri}" />`;

  ring.items.forEach((slug, k) => {
    const ic = icon(slug);
    const hex = `#${visibleHex(ic.hex)}`;
    const phase = (k / ring.items.length) * 2 * Math.PI;
    const pts = [], op = [], sc = [];
    for (let s = 0; s <= STEPS; s++) {
      const a = phase + ring.dir * (s / STEPS) * 2 * Math.PI;
      const [x, y] = at(ring, a);
      const depth = (Math.sin(a) + 1) / 2; // 0 = far back, 1 = front
      pts.push(`${f(x)},${f(y)}`);
      op.push((0.32 + 0.68 * depth).toFixed(2));
      sc.push((0.68 + 0.42 * depth).toFixed(2));
    }
    const anim = `dur="${ring.dur}s" repeatCount="indefinite" calcMode="linear"`;
    items += `
  <g>
    <animateMotion values="${pts.join(";")}" ${anim} />
    <animate attributeName="opacity" values="${op.join(";")}" ${anim} />
    <g>
      <animateTransform attributeName="transform" type="scale" values="${sc.join(";")}" ${anim} />
      <circle r="27" fill="${hex}" opacity="0.16" filter="url(#soft)" />
      <circle r="23" fill="#120A0C" stroke="${hex}" stroke-width="1.8" />
      ${glyph(ic.path, 24, hex)}
      <title>${esc(ic.title)}</title>
    </g>
  </g>`;
  });
});

// The core, drawn twice: whole (under everything), then only its upper
// half on top — so items crossing behind it disappear, items in front don't.
const core = `
  <circle cx="${CX}" cy="${CY}" r="74" fill="url(#coreGlow)" class="breathe" />
  <circle cx="${CX}" cy="${CY}" r="52" fill="url(#coreBody)" stroke="${C.red}" stroke-width="2" />
  <circle cx="${CX}" cy="${CY}" r="60" fill="none" stroke="${C.gold}" stroke-opacity="0.5" stroke-width="1.2" stroke-dasharray="3 7" class="spin" />
  <text x="${CX}" y="${CY - 2}" text-anchor="middle" class="core">PARSA</text>
  <text x="${CX}" y="${CY + 18}" text-anchor="middle" class="coreSub">AI ENGINEER</text>`;

const legend = RINGS.map((r, i) => {
  const x = 40 + i * 190;
  return `<g class="rise" style="animation-delay:${0.3 + i * 0.15}s">
    <circle cx="${x + 6}" cy="${H - 34}" r="6" fill="${r.color}" />
    <text x="${x + 20}" y="${H - 29}" class="leg">${esc(r.name)}</text>
    <text x="${x + 20 + r.name.length * 9 + 8}" y="${H - 29}" class="legN">${r.items.length}</text>
  </g>`;
}).join("");

const total = RINGS.reduce((n, r) => n + r.items.length, 0);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  ${defs(`
    <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.red}" stop-opacity="0.55" />
      <stop offset="100%" stop-color="${C.red}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="coreBody" cx="38%" cy="32%" r="75%">
      <stop offset="0%" stop-color="#3a0a10" />
      <stop offset="100%" stop-color="#0D1117" />
    </radialGradient>
    <filter id="soft" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" /></filter>
    <clipPath id="back"><rect x="0" y="0" width="${W}" height="${CY}" /></clipPath>`)}
  <style>${baseStyle}
    .core    { fill:${C.text}; font-size:19px; font-weight:800; letter-spacing:3px; }
    .coreSub { fill:${C.coral}; font-size:10px; font-weight:700; letter-spacing:2px; }
    .leg     { fill:${C.peach}; font-size:15px; font-weight:700; }
    .legN    { fill:${C.dim}; font-size:15px; }
    .breathe { animation: breathe 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes breathe { 0%,100% { opacity:.6; transform: scale(.94); } 50% { opacity:1; transform: scale(1.06); } }
    .spin    { animation: spin 18s linear infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes spin { to { transform: rotate(360deg); } }
    ${RINGS.map((r, i) => `.flow${i} { animation: flow${i} ${r.dur / 6}s linear infinite; } @keyframes flow${i} { to { stroke-dashoffset: ${r.dir * -32}; } }`).join("\n    ")}
  </style>
  ${frame(H, "// STACK ORBIT", "What I build with",
    `<text x="${W - 40}" y="50" text-anchor="end" class="live">${total} TOOLS · 3 ORBITS</text>`)}
  ${orbits}
  ${core}
  ${items}
  <g clip-path="url(#back)">${core}</g>
  ${legend}
</svg>
`;

writeFileSync(new URL("../assets/orbit.svg", import.meta.url), svg, "utf8");
console.log(`orbit: ${total} tools on ${RINGS.length} orbits`);
