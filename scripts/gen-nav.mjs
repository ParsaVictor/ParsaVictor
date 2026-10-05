// Quick Navigation chips — one small SVG per section, so each can be its own
// link and the row wraps naturally on a phone instead of running off-screen.
//
//   node scripts/gen-nav.mjs

import { mkdirSync, writeFileSync } from "node:fs";

import { MONO, esc } from "./lib/gh.mjs";

export const NAV = [
  ["about", "01", "About"],
  ["atlas", "02", "Skill Atlas"],
  ["stack", "03", "Tech Stack"],
  ["work", "04", "Featured Work"],
  ["activity", "05", "Activity"],
  ["3d", "06", "3D Calendar"],
  ["city", "07", "Skyline & City"],
  ["feed", "08", "Live Feed"],
  ["guestbook", "09", "Guestbook"],
];

mkdirSync(new URL("../assets/nav/", import.meta.url), { recursive: true });

NAV.forEach(([id, num, label], i) => {
  const W = 34 + (num.length + label.length + 2) * 9.6 + 24;
  const H = 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H}" width="${W.toFixed(0)}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F90001" /><stop offset="100%" stop-color="#FFB000" />
    </linearGradient>
  </defs>
  <style>
    text { font-family:${MONO}; font-size:16px; }
    .dot { animation: d 2.4s ease-in-out ${(i * 0.27).toFixed(2)}s infinite; }
    @keyframes d { 0%,100% { opacity:1; } 50% { opacity:.25; } }
  </style>
  <rect x="1" y="1" width="${(W - 2).toFixed(0)}" height="${H - 2}" rx="${(H - 2) / 2}" fill="#140A0D" stroke="url(#g)" stroke-width="1.5" />
  <circle class="dot" cx="20" cy="${H / 2}" r="4.5" fill="#F90001" />
  <text x="34" y="${H / 2 + 5.5}"><tspan fill="#FF6B57" font-weight="700">${num}</tspan><tspan fill="#FFF5F0" font-weight="700"> ${esc(label)}</tspan></text>
</svg>
`;
  writeFileSync(new URL(`../assets/nav/${id}.svg`, import.meta.url), svg, "utf8");
});
console.log(`Wrote ${NAV.length} nav chips`);
