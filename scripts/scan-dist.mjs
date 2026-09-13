// Last step of the build: fail it if the GitHub token could have leaked into
// the output. The token belongs in the Worker's runtime secrets only, so it
// shouldn't be in the build environment at all, and nothing in dist/ should
// look like one.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN_SHAPE = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/;
const BINARY = /\.(woff2?|png|jpe?g|webp|avif|gif|ico|pdf)$/i;
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

const problems = [];

if (process.env.GITHUB_TOKEN) {
  problems.push("GITHUB_TOKEN is set in the build environment. Set it as a Worker secret instead.");
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

for (const file of walk(DIST)) {
  if (BINARY.test(file)) continue;
  if (TOKEN_SHAPE.test(readFileSync(file, "utf8"))) problems.push(`token-shaped string in ${file}`);
}

if (problems.length > 0) {
  console.error(`scan-dist: build blocked\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("scan-dist: no credentials in dist/");
