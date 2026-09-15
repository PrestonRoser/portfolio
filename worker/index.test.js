/**
 * Red-team tests for /api/github. Each test attacks one way the GitHub token
 * could reach a browser and asserts it cannot. Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import config from "../src/data/github.json" with { type: "json" };
import { ROUTE, handle } from "./github.js";
import * as entry from "./index.js";

// Expected failures log fixed warnings; keep the test output readable.
console.warn = () => {};
console.error = () => {};

// Built at runtime so no token-shaped literal sits in the source for secret scanners.
const hex = () => randomUUID().replaceAll("-", "");
const TOKEN = ["github", "pat", `${hex()}${hex()}${hex()}`.slice(0, 82)].join("_");
const OTHER_TOKEN = ["ghp", `${hex()}`.slice(0, 36)].join("_");
const ORIGIN = "https://prestonroser.dev";
const TOKEN_SHAPE = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/;
const EMPTY_STALE = { commits: [], languages: [], fetchedAt: null, stale: true };

function graphql({ message = "feat: add tile", sha = "a".repeat(40) } = {}) {
  return JSON.stringify({
    data: Object.fromEntries(
      config.repos.map((_, i) => [
        `r${i}`,
        {
          defaultBranchRef: {
            target: {
              history: {
                nodes: [
                  {
                    oid: sha,
                    messageHeadline: message,
                    committedDate: "2026-09-12T18:00:00Z",
                    additions: 12,
                    deletions: 3,
                  },
                ],
              },
            },
          },
          languages: {
            edges: [
              { size: 700, node: { name: "TypeScript" } },
              { size: 300, node: { name: "Astro" } },
            ],
          },
        },
      ]),
    ),
  });
}

function memoryCache() {
  const store = new Map();
  return {
    store,
    async match(request) {
      return store.get(new URL(request.url).href)?.clone();
    },
    async put(request, response) {
      store.set(new URL(request.url).href, response.clone());
    },
  };
}

function setup({ upstream = () => new Response(graphql()), token = TOKEN } = {}) {
  const calls = [];
  const pending = [];
  const deps = {
    clock: Date.parse("2026-09-13T12:00:00Z"),
    env: token === null ? {} : { GITHUB_TOKEN: token },
    ctx: { waitUntil: (promise) => pending.push(promise) },
    cache: memoryCache(),
    now: () => deps.clock,
    fetch: async (input, init) => {
      calls.push({ input: String(input), init });
      return upstream(input, init);
    },
  };
  return { deps, calls, pending };
}

async function call(deps, path = ROUTE, init = {}) {
  const res = await handle(new Request(`${ORIGIN}${path}`, init), deps);
  return { res, text: await res.text() };
}

function assertNoLeak({ res, text }) {
  const headers = JSON.stringify([...res.headers]);
  for (const haystack of [text, headers]) {
    assert.ok(!TOKEN_SHAPE.test(haystack), "token-shaped string in response");
    for (let i = 0; i + 16 <= TOKEN.length; i += 1) {
      assert.ok(!haystack.includes(TOKEN.slice(i, i + 16)), "token fragment in response");
    }
  }
}

test("returns only whitelisted fields, and never the token", async () => {
  const { deps, calls } = setup();
  const out = await call(deps);
  assert.equal(out.res.status, 200);
  const body = JSON.parse(out.text);
  assert.deepEqual(Object.keys(body).sort(), ["commits", "fetchedAt", "languages", "stale"]);
  assert.ok(body.commits.length > 0);
  for (const commit of body.commits) {
    assert.deepEqual(Object.keys(commit).sort(), [
      "additions",
      "date",
      "deletions",
      "message",
      "repo",
      "sha",
      "url",
    ]);
  }
  assert.equal(out.res.headers.get("access-control-allow-origin"), null);
  assert.equal(out.res.headers.get("set-cookie"), null);
  assert.equal(calls.length, 1);
  assertNoLeak(out);
});

test("the upstream call is fixed: nothing from the request reaches GitHub", async () => {
  const baseline = setup();
  await call(baseline.deps);

  const attacked = setup();
  const out = await call(
    attacked.deps,
    `${ROUTE}?query=${encodeURIComponent("{viewer{login email}}")}&owner=evil&callback=steal`,
    {
      headers: {
        authorization: "Bearer attacker",
        cookie: "session=1",
        "x-forwarded-host": "evil.test",
        "x-github-token": "please",
      },
    },
  );

  const [upstream] = attacked.calls;
  assert.equal(upstream.input, "https://api.github.com/graphql");
  assert.equal(upstream.init.body, baseline.calls[0].init.body);
  assert.deepEqual(Object.keys(upstream.init.headers).sort(), [
    "authorization",
    "content-type",
    "user-agent",
  ]);
  assert.equal(upstream.init.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(upstream.init.redirect, "manual");
  assertNoLeak(out);
});

test("every method except GET and HEAD is refused without calling GitHub", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const { deps, calls } = setup();
    const init =
      method === "OPTIONS" ? { method } : { method, body: '{"query":"{viewer{login}}"}' };
    const out = await call(deps, ROUTE, init);
    assert.equal(out.res.status, 405, method);
    assert.equal(calls.length, 0, method);
    assertNoLeak(out);
  }
});

test("HEAD returns headers only", async () => {
  const { deps } = setup();
  const out = await call(deps, ROUTE, { method: "HEAD" });
  assert.equal(out.res.status, 200);
  assert.equal(out.text, "");
});

test("other API paths return 404 without calling GitHub", async () => {
  const paths = [
    "/api/github/",
    "/api/github/extra",
    "/api/GITHUB",
    "/api/github.json",
    "/api/githubx",
    "/api/",
    "/api//github",
    "/api/github%2F..%2Fsecret",
  ];
  for (const path of paths) {
    const { deps, calls } = setup();
    const out = await call(deps, path);
    assert.equal(out.res.status, 404, path);
    assert.equal(calls.length, 0, path);
    assertNoLeak(out);
  }
});

test("upstream data echoing the token is blocked, not sent and not cached", async () => {
  const reflections = [
    `leaked ${TOKEN}`,
    `partial ${TOKEN.slice(30, 60)}`,
    `other token ${OTHER_TOKEN}`,
  ];
  for (const message of reflections) {
    const { deps } = setup({ upstream: () => new Response(graphql({ message })) });
    const out = await call(deps);
    assert.equal(out.res.status, 503);
    assert.deepEqual(JSON.parse(out.text), EMPTY_STALE);
    assert.equal(deps.cache.store.size, 0);
    assertNoLeak(out);
  }
});

test("upstream failures return a generic 503 with no detail", async () => {
  const failures = {
    "401 echoing the token": () => new Response(`bad credentials: ${TOKEN}`, { status: 401 }),
    500: () => new Response("internal error", { status: 500 }),
    redirect: () => new Response(null, { status: 302, headers: { location: "https://evil.test" } }),
    "invalid JSON": () => new Response("<html>not json</html>"),
    oversized: () => new Response(graphql(), { headers: { "content-length": String(50_000_000) } }),
    "network error echoing the token": () => {
      throw new Error(`connect failed with ${TOKEN}`);
    },
  };
  for (const [name, upstream] of Object.entries(failures)) {
    const { deps } = setup({ upstream });
    const out = await call(deps);
    assert.equal(out.res.status, 503, name);
    assert.deepEqual(JSON.parse(out.text), EMPTY_STALE, name);
    assertNoLeak(out);
  }
});

test("with no token configured it never calls GitHub", async () => {
  const { deps, calls } = setup({ token: null });
  const out = await call(deps);
  assert.equal(out.res.status, 503);
  assert.equal(calls.length, 0);
});

test("serves from cache, then serves stale while it refreshes", async () => {
  const { deps, calls, pending } = setup();
  await call(deps);
  const second = JSON.parse((await call(deps)).text);
  assert.equal(calls.length, 1);
  assert.equal(second.stale, false);

  deps.clock += 11 * 60 * 1000;
  const stale = JSON.parse((await call(deps, `${ROUTE}?cachebust=${Date.now()}`)).text);
  assert.equal(stale.stale, true);
  await Promise.all(pending);
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse((await call(deps)).text).stale, false);
});

test("upstream data is validated and reshaped, never passed through", async () => {
  const sha = "b".repeat(40);
  const hostile = {
    data: {
      r0: {
        defaultBranchRef: {
          target: {
            history: {
              nodes: [
                {
                  oid: "not-a-sha",
                  messageHeadline: "dropped",
                  committedDate: "2026-09-12T00:00:00Z",
                },
                {
                  oid: sha,
                  messageHeadline: `ctrl\u0000\u001b[31m\u202e${"y".repeat(300)}`,
                  committedDate: "2026-09-11T00:00:00Z",
                  additions: -5,
                  deletions: "9",
                  url: "https://evil.test",
                  author: { email: "someone@example.com" },
                },
              ],
            },
          },
        },
        languages: {
          edges: [
            { size: 10, node: { name: "<script>" } },
            { size: 5, node: { name: "C++" } },
            { size: 1e30, node: { name: "Go" } },
          ],
        },
      },
    },
  };
  const { deps } = setup({ upstream: () => new Response(JSON.stringify(hostile)) });
  const body = JSON.parse((await call(deps)).text);

  assert.equal(body.commits.length, 1);
  const [commit] = body.commits;
  assert.equal(commit.sha, "bbbbbbb");
  assert.ok(commit.message.length <= 120);
  assert.ok(!/[\u0000-\u001f\u007f\u202a-\u202e]/.test(commit.message));
  assert.equal(commit.additions, 0);
  assert.equal(commit.deletions, 0);
  assert.equal(commit.url, `https://github.com/${config.owner}/${config.repos[0]}/commit/${sha}`);
  assert.ok(!JSON.stringify(body).includes("evil.test"));
  assert.ok(!JSON.stringify(body).includes("someone@example.com"));
  assert.deepEqual(
    body.languages.map((l) => l.name),
    ["C++"],
  );
});

test("the Worker bundle has no dependencies", () => {
  const importsOf = (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.ok(!/\bimport\s*\(/.test(source), `${file} has a dynamic import`);
    return [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
  };
  assert.deepEqual(importsOf("./index.js"), ["./github.js"]);
  assert.deepEqual(importsOf("./github.js"), ["../src/data/github.json"]);
});

test("the entry module only has a default export, so the runtime will start", () => {
  assert.deepEqual(Object.keys(entry), ["default"]);
  assert.equal(typeof entry.default.fetch, "function");
});

test("the build-time snapshot never handles credentials", () => {
  const source = readFileSync(new URL("../scripts/github-snapshot.mjs", import.meta.url), "utf8");
  assert.ok(!/process\.env|authorization|bearer|GITHUB_TOKEN/i.test(source));
});

test("wrangler.jsonc routes only /api/* to the Worker and holds no variables", () => {
  const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(source, /"run_worker_first":\s*\[\s*"\/api\/\*"\s*\]/);
  assert.ok(!/"vars"\s*:/.test(source));
  assert.ok(!TOKEN_SHAPE.test(source));
});
