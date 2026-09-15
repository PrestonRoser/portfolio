export const site = {
  name: "Preston Roser",
  url: "https://prestonroser.dev",
  description:
    "Computer Science student at Arizona State University and co-founder of HANDS. Software automation, cloud systems, CI/CD, and full-stack web.",
  email: "prestonroser@gmail.com",
  location: {
    city: "Greeley, Colorado",
    short: "Greeley, CO",
    region: "Northern Colorado",
    // IANA zone, so the clock handles MST/MDT on its own.
    timeZone: "America/Denver",
    lat: 40.4233,
    lng: -104.7091,
    zoom: 11,
  },
  links: {
    github: "https://github.com/PrestonRoser",
    repo: "https://github.com/PrestonRoser/portfolio",
    resume: "/resume.pdf",
    linkedin: "https://www.linkedin.com/in/prestonroser/",
    hands: "https://handslearning.com",
  },
  analytics: {
    // Cloudflare Web Analytics site token. It's public (it ships in the page);
    // leave it empty to skip the beacon.
    cloudflareToken: "5b6546c1a3e24ba3aaa25a1436b95c86",
  },
  nav: [
    { href: "/about", label: "About" },
    { href: "/projects", label: "Projects" },
    { href: "/posts", label: "Posts" },
    { href: "/contact", label: "Contact" },
  ],
} as const;

export const FLAVORS = ["latte", "frappe", "macchiato", "mocha"] as const;
export type Flavor = (typeof FLAVORS)[number];

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
] as const;
export type Accent = (typeof ACCENTS)[number];
