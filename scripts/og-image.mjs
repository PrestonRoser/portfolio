// Renders public/og.png, the image shown in link previews. Run `npm run og`
// after changing the name or tagline and commit the result.
import { flavors } from "@catppuccin/palette";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const c = flavors.mocha.colors;
const sans = "Helvetica Neue, Helvetica, Arial, sans-serif";
const mono = "Menlo, Consolas, monospace";

const grid = [];
for (let x = 0; x <= 1200; x += 48) grid.push(`<path d="M${x} 0V630"/>`);
for (let y = 0; y <= 630; y += 48) grid.push(`<path d="M0 ${y}H1200"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.2" cy="0.25" r="0.7">
      <stop offset="0" stop-color="${c.sapphire.hex}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${c.sapphire.hex}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${c.base.hex}"/>
  <g stroke="${c.surface0.hex}" stroke-width="1" opacity="0.6">${grid.join("")}</g>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <text x="80" y="140" font-family="${mono}" font-size="28" fill="${c.subtext0.hex}">~ / prestonroser.dev /</text>
  <text x="76" y="330" font-family="${sans}" font-size="112" font-weight="700" letter-spacing="-3" fill="${c.text.hex}">Preston Roser</text>
  <text x="80" y="410" font-family="${sans}" font-size="38" fill="${c.subtext1.hex}">Computer Science at ASU · Co-founder of HANDS</text>
  <rect x="80" y="500" width="64" height="6" rx="3" fill="${c.sapphire.hex}"/>
  <text x="80" y="560" font-family="${mono}" font-size="26" fill="${c.sapphire.hex}">Greeley, Colorado</text>
</svg>`;

const out = fileURLToPath(new URL("../public/og.png", import.meta.url));
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
console.log(`wrote ${out}`);
