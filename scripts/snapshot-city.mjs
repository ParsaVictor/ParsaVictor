// Screenshots the live GithubCity page for this profile and saves a real
// PNG — the site itself has no image-export API, so this is the honest way
// to embed it as a "live" image instead of leaving the section empty or
// just linking out.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const USERNAME = "ParsaVictor";
const YEAR = new Date().getUTCFullYear();
const PAGE_URL = `https://honzaap.github.io/GithubCity/?name=${USERNAME}&year=${YEAR}`;
const OUT_DIR = path.resolve(process.cwd(), "assets");
const OUT_PATH = path.join(OUT_DIR, "city-snapshot.png");

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });

page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[page error]", msg.text());
});

await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 60_000 });

// The scene streams in contribution data then builds the 3D model —
// give it real time to settle before capturing a frame.
await page.waitForTimeout(8_000);

await page.screenshot({ path: OUT_PATH });

await browser.close();
console.log(`Saved snapshot to ${OUT_PATH}`);
