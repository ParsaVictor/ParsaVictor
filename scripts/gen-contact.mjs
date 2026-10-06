// Contact cards — one SVG per channel so each is its own link. Each card says
// what you get (the actual handle), gives one clear call to action, and has a
// light running around its border to draw the eye; the four are staggered so
// the light hands off from card to card.
//
//   node scripts/gen-contact.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { C, MONO, esc } from "./lib/gh.mjs";
import { icon, glyph } from "./lib/icons.mjs";

const CARDS = [
  { id: "linkedin", slug: "linkedin", name: "LinkedIn", handle: "in/parsa-karkooti", cta: "Connect", color: "#0A66C2" },
  { id: "telegram", slug: "telegram", name: "Telegram", handle: "@Parsa_Karkooti", cta: "Message", color: "#26A5E4" },
  { id: "email", slug: "gmail", name: "Email", handle: "1.parsa.karkooti@gmail.com", cta: "Write", color: "#EA4335" },
  { id: "github", slug: "github", name: "GitHub", handle: "@ParsaVictor", cta: "Follow", color: "#F0F6FC" },
];

const W = 440, H = 120, R = 18;
const DUR = 6; // one lap of the border light; cards are offset by a quarter each

mkdirSync(new URL("../assets/contact/", import.meta.url), { recursive: true });

CARDS.forEach((card, i) => {
  const ic = icon(card.slug);
  const onBrand = card.id === "github" ? "#0D1117" : "#FFFFFF";
  const handleSize = card.handle.length > 20 ? 15 : 17;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#141019" /><stop offset="100%" stop-color="#1c0a0e" />
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${card.color}" /><stop offset="100%" stop-color="${card.color}" stop-opacity="0.65" />
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fff" stop-opacity="0" /><stop offset="50%" stop-color="#fff" stop-opacity="0.10" /><stop offset="100%" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <clipPath id="card"><rect width="${W}" height="${H}" rx="${R}" /></clipPath>
  </defs>
  <style>
    text { font-family: ${MONO}; }
    .name   { fill:${C.text}; font-size:24px; font-weight:800; }
    .handle { fill:${C.peach}; font-size:${handleSize}px; }
    .cta    { fill:${C.text}; font-size:15px; font-weight:800; letter-spacing:1px; }
    .run    { stroke-dasharray: 0.16 0.84; animation: run ${DUR}s linear ${(-i * DUR) / 4}s infinite; }
    @keyframes run { to { stroke-dashoffset: -1; } }
    .sheen  { animation: sheen ${DUR}s ease-in-out ${(i * DUR) / 4}s infinite; }
    @keyframes sheen { 0% { transform: translateX(-160px); } 30%,100% { transform: translateX(${W + 160}px); } }
    .nudge  { animation: nudge 1.6s ease-in-out infinite; }
    @keyframes nudge { 0%,100% { transform: translateX(0); } 50% { transform: translateX(5px); } }
    .ping   { transform-box: fill-box; transform-origin: center; animation: ping 2.4s ease-out ${(i * 0.6).toFixed(1)}s infinite; }
    @keyframes ping { 0% { transform: scale(1); opacity:.7; } 100% { transform: scale(1.45); opacity:0; } }
  </style>

  <rect width="${W}" height="${H}" rx="${R}" fill="url(#bg)" />
  <g clip-path="url(#card)"><rect class="sheen" x="0" y="0" width="140" height="${H}" fill="url(#sheen)" /></g>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" fill="none" stroke="${card.color}" stroke-opacity="0.28" stroke-width="1.5" />
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}" fill="none" stroke="${card.color}" stroke-width="2.5" pathLength="1" class="run" filter="url(#glow)" />

  <rect x="22" y="22" width="76" height="76" rx="20" fill="none" stroke="${card.color}" stroke-width="2" class="ping" />
  <rect x="22" y="22" width="76" height="76" rx="20" fill="url(#tile)" />
  <g transform="translate(60 60)">${glyph(ic.path, 40, onBrand)}</g>

  <text x="120" y="52" class="name">${esc(card.name)}</text>
  <text x="120" y="86" class="handle">${esc(card.handle)}</text>

  <g class="nudge">
    <rect x="${W - 132}" y="20" width="112" height="28" rx="14" fill="${card.color}" fill-opacity="0.18" stroke="${card.color}" stroke-opacity="0.7" />
    <text x="${W - 76}" y="39" text-anchor="middle" class="cta">${esc(card.cta)} →</text>
  </g>
</svg>
`;
  writeFileSync(new URL(`../assets/contact/${card.id}.svg`, import.meta.url), svg, "utf8");
});
console.log(`Wrote ${CARDS.length} contact cards`);
