// Records a fly-around of the live GithubCity page for this profile and
// encodes it as a looping GIF. A README can't host the live WebGL scene, but
// it can play an animation of it — so the camera is orbited frame by frame
// (deterministic, independent of how slowly the CI GPU renders) and ffmpeg
// stitches the frames together. A still PNG is kept as well.
//
//   node scripts/snapshot-city.mjs      (needs ffmpeg on PATH)

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const USERNAME = "ParsaVictor";
const YEAR = new Date().getUTCFullYear();
const PAGE_URL = `https://honzaap.github.io/GithubCity/?name=${USERNAME}&year=${YEAR}`;
// Published to the `city-output` branch by the workflow (force-pushed, one
// commit) so weekly multi-MB GIFs don't pile up in main's history.
const OUT_DIR = path.resolve(process.cwd(), process.argv[2] || "dist-city");
const FRAMES = 60; // 5 s at 12 fps
const VIEW_W = 640;
const VIEW_H = 360;
// OrbitControls turns 2π per viewport-height of horizontal drag, so this
// step makes the frames one full, seamlessly looping revolution.
const STEP = VIEW_H / FRAMES;

mkdirSync(OUT_DIR, { recursive: true });
const tmp = mkdtempSync(path.join(tmpdir(), "city-"));

// Software WebGL on CI renders a frame every few seconds — small viewport,
// generous timeouts.
const browser = await chromium.launch({ args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
page.setDefaultTimeout(180_000);
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[page error]", msg.text());
});

await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 90_000 });
// The scene streams in contribution data then builds the 3D model.
await page.waitForTimeout(9_000);

// Hide the site's UI so the frame is just the city and its name tag.
await page.addStyleTag({
  content:
    "a,button,input,form,label,footer,.selectize-control,.buttons-options,.options-caption,.github-corner,#shadowPreset{display:none!important}",
});

// Ease in a little closer, then orbit by dragging the orbit controls.
const X0 = VIEW_W * 0.78;
const Y0 = VIEW_H * 0.55;
await page.mouse.move(X0, Y0);
await page.mouse.wheel(0, -200);
await page.waitForTimeout(1_000);
await page.mouse.down();
for (let i = 0; i < FRAMES; i++) {
  await page.mouse.move(X0 - i * STEP, Y0, { steps: 2 });
  await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(3, "0")}.png`) });
  if (i % 10 === 0) console.log(`frame ${i}/${FRAMES}`);
}
await page.mouse.up();
await browser.close();

copyFileSync(path.join(tmp, "f000.png"), path.join(OUT_DIR, "city-snapshot.png"));

// Two-pass palette GIF, undithered: the low-poly city is flat colour, and
// dithering only adds noise that roughly doubles the file size.
const gif = path.join(OUT_DIR, "city-flyover.gif");
execFileSync("ffmpeg", [
  "-v", "error", "-y",
  "-framerate", "12",
  "-i", path.join(tmp, "f%03d.png"),
  "-vf",
  "split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
  "-loop", "0",
  gif,
]);

rmSync(tmp, { recursive: true, force: true });
console.log(`Saved ${gif}`);
