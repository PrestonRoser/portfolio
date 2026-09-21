// Renders src/assets/previews/<slug>.webp, the site preview shown on a project's
// page. Projects with a live site get a screenshot of it; projects with only a
// GitHub repo get the repo's social card. Run `npm run previews` after adding or
// changing a project URL, check the images, and commit them.
//
// To use your own image instead, save it as src/assets/previews/<slug>.png (or
// .jpg) and this script will leave that project alone.
//
// Screenshots need a local Chrome or Chromium. Set CHROME to its path if it
// isn't in the usual place.
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import sharp from "sharp";

const PROJECTS = fileURLToPath(new URL("../src/content/projects/", import.meta.url));
const OUT = fileURLToPath(new URL("../src/assets/previews/", import.meta.url));
const VIEWPORT = { width: 1440, height: 900 };
const CHROME =
  process.env.CHROME ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find(existsSync);

// Only a slug given on the command line is rendered, e.g. `npm run previews -- hands-website`.
const only = process.argv[2];

function frontmatter(file) {
  const block =
    readFileSync(join(PROJECTS, file), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const field = (name) => block.match(new RegExp(`^${name}:\\s*["']?(\\S+?)["']?\\s*$`, "m"))?.[1];
  return { url: field("url"), repo: field("repo") };
}

// Chrome writes the screenshot well before it exits (a pending update can keep
// it alive indefinitely), so wait for the file instead of the process.
async function screenshot(url) {
  if (!CHROME) throw new Error("no Chrome found; set CHROME to its path");
  const dir = mkdtempSync(join(tmpdir(), "preview-"));
  const file = join(dir, "shot.png");
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--hide-scrollbars",
      "--disable-extensions",
      "--no-first-run",
      "--force-device-scale-factor=1",
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      "--virtual-time-budget=8000",
      `--user-data-dir=${join(dir, "profile")}`,
      `--screenshot=${file}`,
      url,
    ],
    { stdio: "ignore" },
  );
  try {
    for (let waited = 0; waited < 60_000; waited += 500) {
      await sleep(500);
      if (existsSync(file) && statSync(file).size > 0) {
        await sleep(500);
        return readFileSync(file);
      }
      if (chrome.exitCode !== null) break;
    }
    throw new Error("Chrome produced no screenshot");
  } finally {
    if (chrome.exitCode === null) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await Promise.race([exited, sleep(3000)]);
    }
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function repoCard(repo) {
  const path = new URL(repo).pathname.replace(/^\/|\/$/g, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(path)) throw new Error(`not a GitHub repo URL: ${repo}`);
  const res = await fetch(`https://opengraph.githubassets.com/1/${path}`, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} from GitHub for ${path}`);
  return Buffer.from(await res.arrayBuffer());
}

mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(PROJECTS).filter((f) => /\.mdx?$/.test(f))) {
  const slug = file.replace(/\.mdx?$/, "");
  if (only && slug !== only) continue;
  const { url, repo } = frontmatter(file);
  if (!url && !repo) continue;
  if (["png", "jpg", "jpeg"].some((ext) => existsSync(join(OUT, `${slug}.${ext}`)))) {
    console.log(`previews: ${slug} has a hand-picked image, leaving it`);
    continue;
  }

  try {
    const image = url ? await screenshot(url) : await repoCard(repo);
    await sharp(image)
      .webp({ quality: 82 })
      .toFile(join(OUT, `${slug}.webp`));
    console.log(`previews: ${slug} ← ${url ?? repo}`);
  } catch (error) {
    console.warn(`previews: skipped ${slug} (${error.message})`);
  }
}
