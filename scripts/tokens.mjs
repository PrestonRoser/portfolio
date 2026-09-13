/**
 * Generates src/styles/tokens.css from the Catppuccin palette.
 *
 * On top of the stock colours, every accent gets two extras per flavour:
 *   ink  the accent darkened or lightened (hue kept) until it reads as text,
 *        at least 4.5:1 on base, mantle and crust
 *   on   the text colour to put on a solid accent fill
 *
 * Run `npm run tokens` after changing anything here.
 */
import { flavors } from "@catppuccin/palette";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const FLAVORS = ["latte", "frappe", "macchiato", "mocha"];

export const ACCENTS = [
  "rosewater",
  "flamingo",
  "pink",
  "mauve",
  "red",
  "maroon",
  "peach",
  "yellow",
  "green",
  "teal",
  "sky",
  "sapphire",
  "blue",
  "lavender",
];

/** Darkest to lightest on the dark flavours; Latte runs the other way. */
export const NEUTRALS = [
  "crust",
  "mantle",
  "base",
  "surface0",
  "surface1",
  "surface2",
  "overlay0",
  "overlay1",
  "overlay2",
  "subtext0",
  "subtext1",
  "text",
];

export const DEFAULT_ACCENT = "sapphire";

const MIN_CONTRAST = 4.5;
const ON_DARK = flavors.mocha.colors.crust.hex;
const ON_LIGHT = flavors.latte.colors.base.hex;

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const clamp01 = (c) => Math.min(1, Math.max(0, c));
const rgbToHex = (rgb) =>
  "#" +
  rgb
    .map((c) =>
      Math.round(clamp01(c) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two hex colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toOklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return rgbToHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map((c) => toGamma(clamp01(c))),
  );
}

function inkFor(flavor, accent) {
  const c = flavors[flavor].colors;
  const grounds = [c.base.hex, c.mantle.hex, c.crust.hex];
  const passes = (hex) => Math.min(...grounds.map((g) => contrast(hex, g))) >= MIN_CONTRAST;
  if (passes(c[accent].hex)) return c[accent].hex;
  const [L, a, b] = toOklab(c[accent].hex);
  const step = flavors[flavor].dark ? 0.005 : -0.005;
  for (let l = L + step; l > 0 && l < 1; l += step) {
    const hex = fromOklab([l, a, b]);
    if (passes(hex)) return hex;
  }
  return c.text.hex;
}

function onFor(flavor, accent) {
  const fill = flavors[flavor].colors[accent].hex;
  const best = contrast(ON_DARK, fill) >= contrast(ON_LIGHT, fill) ? ON_DARK : ON_LIGHT;
  if (contrast(best, fill) >= MIN_CONTRAST) return best;
  return contrast("#ffffff", fill) > contrast(best, fill) ? "#ffffff" : best;
}

/** Every custom property one flavour defines, as [name, value] pairs. */
export function flavorTokens(flavor) {
  const c = flavors[flavor].colors;
  const entries = [...NEUTRALS, ...ACCENTS].map((n) => [`--ctp-${n}`, c[n].hex]);
  for (const a of ACCENTS) {
    entries.push([`--ink-${a}`, inkFor(flavor, a)], [`--on-${a}`, onFor(flavor, a)]);
  }
  return entries;
}

// OpenStreetMap tiles only come in light, so the dark flavours invert them.
const MAP_TILES_FILTER = {
  latte: "grayscale(0.4) contrast(0.95)",
  frappe: "grayscale(0.85) invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.85)",
  macchiato: "grayscale(0.85) invert(1) hue-rotate(180deg) brightness(0.88) contrast(0.85)",
  mocha: "grayscale(0.85) invert(1) hue-rotate(180deg) brightness(0.8) contrast(0.85)",
};

export const flavorDeclarations = (flavor) => [
  `color-scheme: ${flavors[flavor].dark ? "dark" : "light"};`,
  `--map-tiles-filter: ${MAP_TILES_FILTER[flavor]};`,
  ...flavorTokens(flavor).map(([k, v]) => `${k}: ${v};`),
];

export const accentDeclarations = (accent) => [
  `--accent: var(--ctp-${accent});`,
  `--accent-ink: var(--ink-${accent});`,
  `--on-accent: var(--on-${accent});`,
];

/** Lowest measured contrast for ink-on-ground and on-accent-on-fill, across all 56 pairs. */
export function contrastReport() {
  let ink = { ratio: Infinity };
  let on = { ratio: Infinity };
  let adjusted = 0;
  for (const flavor of FLAVORS) {
    const c = flavors[flavor].colors;
    for (const accent of ACCENTS) {
      const inkHex = inkFor(flavor, accent);
      if (inkHex !== c[accent].hex) adjusted += 1;
      const inkRatio = Math.min(
        ...[c.base.hex, c.mantle.hex, c.crust.hex].map((g) => contrast(inkHex, g)),
      );
      if (inkRatio < ink.ratio) ink = { ratio: inkRatio, flavor, accent };
      const onRatio = contrast(onFor(flavor, accent), c[accent].hex);
      if (onRatio < on.ratio) on = { ratio: onRatio, flavor, accent };
    }
  }
  return { ink, on, adjusted };
}

const block = (selector, declarations) =>
  `${selector} {\n${declarations.map((d) => `  ${d}`).join("\n")}\n}`;

const indent = (css) =>
  css
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

/**
 * Shiki highlights once with all four flavours as variables (astro.config.mjs).
 * These rules pick the set matching the page flavour, under the same selectors
 * as the colour tokens.
 */
function shikiRules(scope, flavor) {
  const code = scope ? `${scope} .astro-code` : ".astro-code";
  return [
    block(code, [`background-color: var(--shiki-${flavor}-bg);`]),
    block(`${code},\n${code} span`, [
      `color: var(--shiki-${flavor});`,
      `font-style: var(--shiki-${flavor}-font-style);`,
      `font-weight: var(--shiki-${flavor}-font-weight);`,
    ]),
  ].join("\n\n");
}

/**
 * Stylesheet for the site. The theme script in Layout.astro puts a flavour
 * class on <html> and a data-accent attribute; without JavaScript the page
 * follows the OS: Latte in light mode, Mocha in dark mode, Sapphire accent.
 */
export function siteCss() {
  return [
    "/* Generated by scripts/tokens.mjs. Do not edit by hand. */",
    block(":root,\n.latte", [
      ...flavorDeclarations("latte"),
      ...accentDeclarations(DEFAULT_ACCENT),
    ]),
    block(".frappe", flavorDeclarations("frappe")),
    block(".macchiato", flavorDeclarations("macchiato")),
    block(".mocha", flavorDeclarations("mocha")),
    `@media (prefers-color-scheme: dark) {\n${indent(
      block(":root:not(.latte, .frappe, .macchiato)", flavorDeclarations("mocha")),
    )}\n}`,
    ...ACCENTS.map((a) => block(`[data-accent="${a}"]`, accentDeclarations(a))),
    shikiRules("", "latte"),
    shikiRules(".frappe", "frappe"),
    shikiRules(".macchiato", "macchiato"),
    shikiRules(".mocha", "mocha"),
    `@media (prefers-color-scheme: dark) {\n${indent(
      shikiRules(":root:not(.latte, .frappe, .macchiato)", "mocha"),
    )}\n}`,
  ].join("\n\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = new URL("../src/styles/tokens.css", import.meta.url);
  writeFileSync(out, `${siteCss()}\n`);
  const { ink, on, adjusted } = contrastReport();
  console.log(`wrote ${fileURLToPath(out)}`);
  console.log(
    `ink: lowest ${ink.ratio.toFixed(2)}:1 (${ink.flavor} ${ink.accent}); ${adjusted} of 56 adjusted`,
  );
  console.log(`on-accent: lowest ${on.ratio.toFixed(2)}:1 (${on.flavor} ${on.accent})`);
}
