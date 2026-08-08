# Next Plugin Repo Hosting — Design (Phase 1 of 3)

## Context

`revenge-next-plugs` had no reliable way to get a build onto a phone. The immediate
trigger was debugging staff-tags (which showed no tags anywhere on-device): the
investigation found the actual root cause was a broken build pipeline
(`@revenge-mod/plugin-cli`'s bin has no prebuilt `dist/main.js`, so it always falls
back to importing raw `src/main.ts`, which Node's shebang-driven execution refuses to
type-strip inside `node_modules` — this broke both `bun run build` and Gradle's
`packageAllPlugins`, which shells out to the same command). That's already fixed
(`package.json`'s `build`/`build:dev`/`generate-index`/`serve` scripts now invoke the
CLI via `bun` directly). But even with a working build, this sandbox has no network
path to the phone, and Revenge Next only installs plugins via a repository URL fetched
over HTTP (`{baseUrl}/index.json` — confirmed from the CLI's own `serve.ts`) — there is
no local-file/zip-picker install path in the app.

Separately, the user wants a system "like Classic revenge-plugins has": that turned out
to be two distinct things bundled into one Cloudflare Worker — a browsable showcase
site with live-editable metadata (D1 + KV + a Durable Object WebSocket hub), and a
from-phone draft-plugin fast path that serves raw, unbundled JS directly from a
database row. Both depend on Classic's single-file `mainJs` plugin model, which does
not exist in Next — Next plugins are zips containing a manifest, a **bundled** JS
output (TS/TSX via the CLI's bundler), optional native Kotlin/DEX code, and
sha256-pinned versions/channels.

Given the format mismatch and the size of a literal port, the work is split into three
phases, each its own spec:

1. **Repo hosting** (this doc) — the actual installable plugin repository. Solves the
   immediate blocker on its own.
2. **Showcase site** — browsable catalog with live-editable metadata, adapted from
   Classic's D1/KV/DO overlay, reusing this phase's build output.
3. **Draft-editing fast path** — from-phone instant edit/install for real plugin code.
   Hardest and most speculative, since Next needs TS bundling that Classic's raw-JS
   model never had to deal with. Design deferred until Phase 1/2 are live.

## Goals (Phase 1)

- A public, permanently-reachable URL that Revenge Next can add as a plugin
  repository, independent of this sandbox's network reachability.
- Every push to `main` rebuilds and redeploys automatically — no manual file
  transfer, ever again.
- Reuse the existing, already-correct build tooling (Gradle + the CLI) rather than
  duplicating packaging logic.

## Non-goals (Phase 1)

- Showcase site, live-editable metadata, D1/KV/Durable Objects, WebSocket broadcast,
  from-phone draft editing. All deferred to Phases 2 and 3.

## Design

### Repo

New public GitHub repo `everestmcarthur/revenge-next-plugs`, pushed fresh from the
current working tree as a clean initial history (not a fork, not from a template).
Local default branch renamed `master` → `main` before the first push, to match GitHub
convention and the CI trigger below.

### Build/package pipeline

No new packaging logic. `bun run build` and `./gradlew packageAllPlugins` both already
work (verified locally this session — no Android SDK needed today, since both existing
plugins, staff-tags and next-eval-checks, are JS-only) and produce `build/dist/*.zip`.
CI invokes the same commands a developer would run locally.

### Cloudflare Worker

An assets-only Worker (no `main` script, no bindings) named `revenge-next-plugs`,
serving `build/dist/` as static assets — the generated `index.json` plus the plugin
zips, side by side. New `wrangler.toml` at repo root:

```toml
name = "revenge-next-plugs"
compatibility_date = "2026-08-08"
account_id = "dc5e308f1df2d6bb5082951d3f3993a5"

[assets]
directory = "build/dist"

[[routes]]
pattern = "next.jarviscli.dev"
custom_domain = true
```

Verified against the live Cloudflare account: `jarviscli.dev` is an active zone in the
same account the deploy token authenticates against; `next.jarviscli.dev` has no
existing DNS record; no Worker is already named `revenge-next-plugs`. Wrangler creates
the DNS record and certificate automatically on first deploy — no manual DNS step.

This Worker can grow a real `main` script later (Phase 2) without restructuring: Cloudflare
serves a matching static asset first and only falls through to Worker code for
unmatched paths, so adding a `fetch` handler on top of an existing assets Worker is
additive.

### CI/CD

New `.github/workflows/deploy.yml`, triggered on push to `main`, mirroring the shape of
Classic's `deploy.yml`:

1. `actions/checkout`
2. Set up `bun` and JDK 25 (no Android SDK — not needed until a native plugin exists)
3. `bun install`
4. `./gradlew packageAllPlugins` → `build/dist/*.zip`
5. `bun run generate-index -- --dist build/dist --base-url https://next.jarviscli.dev --out build/dist/index.json`
6. `wrangler deploy`, authenticated via a `CLOUDFLARE_API_TOKEN` repository secret
   (scoped API token, not Classic's legacy global-API-key + email pair)

### Verification

Add `https://next.jarviscli.dev` as a repository in Revenge Next (bare base URL — the
app fetches `/index.json` itself, confirmed from the CLI's `serve.ts` reference
implementation). Reinstall staff-tags from there. This is the deferred
single-variable test from the debugging session: whether a guild-owner chat message
now shows a tag, now that a *current* build (with the already-fixed `getTagProperties`
patch) is actually reachable from the phone. staff-tags' remaining known bugs
(`HeaderName`/`DisplayName`/`UserRow` lookups) are unrelated to this phase and stay
open.

### Error handling

- Wrangler deploy failure (e.g. bad token) fails the GitHub Actions run visibly; no
  silent partial deploy, since Wrangler uploads assets and routes as one operation.
- A build/package failure (Gradle or bun) fails the workflow before any deploy step
  runs, so a broken build never overwrites a working deployed repo with something
  half-finished — deploy is the last step.

### Testing

No automated tests for this phase (it's infrastructure/CI, not application code). The
verification step above (reinstall staff-tags from the live URL, confirm the app
successfully lists/installs from it) is the acceptance check.

## Open questions for later phases

- Phase 2: exact shape of the showcase site's data model for Next (Classic's
  tagline/accent/features/commands/howItWorks fields may not all make sense for a
  zip+manifest+native format).
- Phase 3: feasibility of in-Worker TS transpilation for single-file drafts (Next
  plugins reference `@revenge-mod/*` as externals resolved by the host at runtime, not
  bundled in, which may make a lightweight transpile-only draft path more tractable
  than a full bundle — unconfirmed, needs its own investigation).
