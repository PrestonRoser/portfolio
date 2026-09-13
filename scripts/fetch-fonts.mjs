// Downloads Satoshi into public/fonts/satoshi/ before dev and build.
//
// Satoshi's license (ITF Free Font License) allows self-hosting it on this site
// but not redistributing the files, so they're fetched from Fontshare instead of
// living in the repo. Skips the download if the files are already there.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/fonts/satoshi/", import.meta.url);
const CSS_URL = "https://api.fontshare.com/v2/css?f[]=satoshi@1,2&display=swap";
const FILES = { normal: "Satoshi-Variable.woff2", italic: "Satoshi-VariableItalic.woff2" };

if (Object.values(FILES).every((file) => existsSync(new URL(file, OUT)))) process.exit(0);

mkdirSync(OUT, { recursive: true });

const css = await (await fetch(CSS_URL)).text();
const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
  family: body.match(/font-family:\s*'([^']+)'/)?.[1],
  style: body.match(/font-style:\s*(\w+)/)?.[1],
  url: body.match(/url\('([^']+\.woff2)'\)/)?.[1],
}));

for (const [style, file] of Object.entries(FILES)) {
  const face = faces.find((f) => f.family === "Satoshi" && f.style === style && f.url);
  if (!face) throw new Error(`Fontshare returned no Satoshi ${style} woff2 (${CSS_URL})`);
  // Fontshare's URLs are protocol-relative, so resolve them against the CSS URL.
  const response = await fetch(new URL(face.url, CSS_URL));
  if (!response.ok) throw new Error(`Satoshi ${style}: HTTP ${response.status}`);
  writeFileSync(new URL(file, OUT), Buffer.from(await response.arrayBuffer()));
  console.log(`fonts: saved public/fonts/satoshi/${file}`);
}
