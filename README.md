# prestonroser.dev

My personal site. It's built with Astro and Tailwind, with a few Svelte islands for the parts
that update live, and it runs on Cloudflare Workers.

## Running it locally

You'll need Node 22.12 or newer.

```sh
npm install
npm run dev
```

The site runs at http://localhost:4321. The first run downloads the Satoshi font files and a
snapshot of recent GitHub activity.

To try the `/api/github` Worker and the production security headers too, build first and serve
with Wrangler:

```sh
npm run build
npx wrangler dev
```

Without a token in `.dev.vars`, the API answers 503 and the GitHub tiles stay on the build-time
snapshot.

## Scripts

| Command           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `npm run dev`     | Dev server                                                           |
| `npm run build`   | Production build, then writes security headers and scans for secrets |
| `npm run preview` | Serve the built site                                                 |
| `npm test`        | Tests for the `/api/github` Worker                                   |
| `npm run check`   | `astro check`                                                        |
| `npm run format`  | Prettier                                                             |
| `npm run tokens`  | Regenerate `src/styles/tokens.css` from the Catppuccin palette       |
| `npm run og`      | Regenerate `public/og.png`                                           |

## Layout

- `src/pages`: routes
- `src/components`: Astro components and Svelte islands
- `src/data`: site settings, experience, skills, and LinkedIn posts
- `src/content/projects`: project write-ups
- `src/assets/projects`: optional cover images, named after the project file (`sqaas.webp` for
  `sqaas.mdx`). Cards without one skip the cover.
- `src/icons/skills`: logos for the skills marquee, from [Simple Icons](https://simpleicons.org)
  (CC0) and [Devicon](https://devicon.dev) (MIT, see `LICENSE-devicon`)
- `worker/index.js`: serves `/api/github`
- `scripts/`: theme tokens, font download, GitHub snapshot, security headers, and the output scan

## Branches and environments

| Branch | Environment | URL                         | Deploys                  |
| ------ | ----------- | --------------------------- | ------------------------ |
| `main` | production  | https://prestonroser.dev    | on push, after CI passes |
| `qa`   | qa          | https://qa.prestonroser.dev | on push, after CI passes |
| `dev`  | none        |                             | CI only                  |

Work happens on short-lived branches (`feat/…`, `fix/…`) opened as pull requests into `dev`.
From there changes are promoted with pull requests `dev → qa → main`. Urgent fixes go on a
`hotfix/…` branch straight into `main` (or `qa`), then `main` is merged back down.

Squash-merge feature branches into `dev`, but use a merge commit when promoting `dev → qa` and
`qa → main`, so the three branches share history and later promotions don't conflict.

All three branches are protected: changes land through pull requests, CI has to pass, and force
pushes and deletions are blocked. The "Branch flow" check rejects pull requests that skip a
stage. The qa site sends `X-Robots-Tag: noindex` so it stays out of search results.

## CI/CD

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `dev`: dependency
  audit, formatting, Worker tests, type check, and the production build with its secret scan.
- **Deploy** (`.github/workflows/deploy.yml`) runs on pushes to `qa` and `main`. It reruns CI,
  builds, and runs `wrangler deploy` inside the matching GitHub environment. Deploys stay off until
  the repository variable `DEPLOY_ENABLED` is `true`.
- **Dependabot** opens weekly npm and GitHub Actions updates against `dev`.
- Third-party actions are pinned to commit SHAs.

Each GitHub environment (`production`, `qa`) needs two secrets:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token from the "Edit Cloudflare Workers" template
- `CLOUDFLARE_ACCOUNT_ID`

Deploy only through GitHub Actions. If the Cloudflare dashboard's Git integration (Workers Builds)
is connected as well, every push deploys twice.

## Secrets

The GitHub token the Worker uses is a Cloudflare runtime secret, set once per environment:

```sh
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GITHUB_TOKEN --env qa
```

Use a fine-grained token with access to public repositories only. It never goes in GitHub
secrets or the build environment. If it's present during a build, the build fails.

## Fonts

Satoshi comes from [Fontshare](https://www.fontshare.com/fonts/satoshi) under the ITF Free Font
License, which doesn't allow redistributing the files. They're downloaded when you run the site
rather than kept in the repo. JetBrains Mono is from Fontsource.

## License

The code is MIT licensed. The writing, project descriptions, and images are mine, so please ask
before reusing them.
