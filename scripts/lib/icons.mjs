// Brand glyphs from simple-icons (CC0-1.0): a single path on a 24×24 grid
// plus the brand's hex colour. LinkedIn left simple-icons for trademark
// reasons, so its mark is drawn by hand here.

import * as si from "simple-icons";

const bySlug = new Map(
  Object.values(si)
    .filter((v) => v && typeof v === "object" && v.slug && v.path)
    .map((v) => [v.slug, v])
);

const LINKEDIN = {
  title: "LinkedIn",
  hex: "0A66C2",
  path: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z",
};

export function icon(slug) {
  if (slug === "linkedin") return LINKEDIN;
  const v = bySlug.get(slug);
  if (!v) throw new Error(`simple-icons has no "${slug}"`);
  return { title: v.title, hex: v.hex, path: v.path };
}

// Brand colours that would vanish on the dark cards (black, near-black)
// get the profile coral instead.
export function visibleHex(hex) {
  const n = parseInt(hex, 16);
  const lum = 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 60 ? "FF6B57" : hex;
}

// <g> placing a 24×24 glyph centred on (0,0) at the given pixel size.
export const glyph = (path, size, fill) =>
  `<g transform="translate(${-size / 2} ${-size / 2}) scale(${(size / 24).toFixed(4)})"><path d="${path}" fill="${fill}" /></g>`;
