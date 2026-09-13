// Entry point for the prestonroser.dev Worker. Static files are served straight
// from dist/, so this only sees /api/* requests (run_worker_first in wrangler.jsonc).
//
// Keep this file down to the default export: the Workers runtime treats every
// named export of the entry module as a handler and refuses to start otherwise.
import { handle } from "./github.js";

export default {
  fetch(request, env, ctx) {
    return handle(request, {
      env,
      ctx,
      assets: env.ASSETS,
      cache: caches.default,
      fetch: (input, init) => fetch(input, init),
      now: () => Date.now(),
    });
  },
};
