// The shared "card" chrome every generated panel sits in — background,
// grid, border, scanning sweep, kicker + title and a top-right slot — so the
// dashboard, trophies and guestbook read as one system.

import { C, MONO } from "./gh.mjs";

export const W = 900;

export const defs = (extra = "") => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117" />
      <stop offset="60%" stop-color="#140709" />
      <stop offset="100%" stop-color="#22070C" />
    </linearGradient>
    <linearGradient id="hot" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F90001" />
      <stop offset="100%" stop-color="#FFB000" />
    </linearGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F90001" stop-opacity="0" />
      <stop offset="50%" stop-color="#F90001" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#F90001" stop-opacity="0" />
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M30 0H0V30" fill="none" stroke="#F90001" stroke-opacity="0.05" />
    </pattern>
    ${extra}
  </defs>`;

export const baseStyle = `
  text { font-family: ${MONO}; }
  .kicker { fill:${C.coral}; font-size:15px; font-weight:700; letter-spacing:4px; }
  .title  { fill:${C.text}; font-size:30px; font-weight:800; }
  .live   { fill:${C.peach}; font-size:14px; font-weight:700; letter-spacing:2px; }
  .lbl    { fill:${C.dim}; font-size:15px; font-weight:700; letter-spacing:2px; }
  .val    { fill:${C.text}; font-weight:800; }
  .foot   { fill:#8a5550; font-size:15px; }
  .rise   { opacity:0; animation: rise .8s cubic-bezier(.2,.8,.2,1) forwards; }
  @keyframes rise { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform:none; } }
  .pulse  { animation: pulse 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes pulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:.35; transform: scale(1.8); } }
  .scan   { animation: scan 6s linear infinite; }
  @keyframes scan { from { transform: translateX(-200px); } to { transform: translateX(${W + 200}px); } }
`;

// A pulsing "LIVE" tag plus a date — the default top-right slot.
export const liveTag = (stamp) => `
  <circle class="pulse" cx="${W - 196}" cy="45" r="5" fill="${C.red}" />
  <text x="${W - 182}" y="50" class="live">LIVE</text>
  <text x="${W - 40}" y="50" text-anchor="end" class="foot">${stamp}</text>`;

export const frame = (H, kicker, title, right = "") => `
  <rect width="${W}" height="${H}" rx="18" fill="url(#bg)" />
  <rect width="${W}" height="${H}" rx="18" fill="url(#grid)" />
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="${C.red}" stroke-opacity="0.35" />
  <rect class="scan" x="0" y="0" width="140" height="${H}" fill="url(#sweep)" opacity="0.5" />
  <text x="40" y="50" class="kicker">${kicker}</text>
  <text x="40" y="88" class="title">${title}</text>
  ${right}`;
