// Writes dist/_headers, which Cloudflare applies to every static file. The
// Worker sets its own headers on /api responses.
//
// script-src doesn't allow 'unsafe-inline'. Instead every inline <script> in
// the built pages (the theme bootstrap, Astro's island loader, JSON-LD) is
// hashed and allowed individually, so a script that wasn't in the build can't run.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

const hashes = new Set();
for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, "utf8");
  for (const [, attributes = "", body] of html.matchAll(
    /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi,
  )) {
    if (/\ssrc\s*=/i.test(` ${attributes}`)) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].sort().join(" ")} https://static.cloudflareinsights.com`,
  // Inline style attributes come from the theme swatches and chart widths.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://tile.openstreetmap.org https://media.prestonroser.dev",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Staging shouldn't end up in search results.
const robots = process.env.DEPLOY_ENV === "qa" ? "\n  X-Robots-Tag: noindex, nofollow" : "";

const headers = `/*
  Content-Security-Policy: ${csp}${robots}
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=2592000
`;

// Cloudflare ignores any _headers line longer than 2,000 characters.
const longest = Math.max(...headers.split("\n").map((line) => line.length));
if (longest > 2000) {
  console.error(`security-headers: a header line is ${longest} characters (limit 2,000)`);
  process.exit(1);
}

writeFileSync(join(DIST, "_headers"), headers);
console.log(`security-headers: wrote dist/_headers (${hashes.size} inline script hashes)`);
