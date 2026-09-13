// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import svelte from "@astrojs/svelte";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://prestonroser.dev",

  integrations: [svelte(), mdx(), sitemap()],

  markdown: {
    // Code blocks carry all four Catppuccin flavours as CSS variables, and
    // tokens.css picks the right set for whichever theme is active.
    shikiConfig: {
      themes: {
        latte: "catppuccin-latte",
        frappe: "catppuccin-frappe",
        macchiato: "catppuccin-macchiato",
        mocha: "catppuccin-mocha",
      },
      defaultColor: false,
    },
  },

  vite: { plugins: [tailwindcss()] },
});
