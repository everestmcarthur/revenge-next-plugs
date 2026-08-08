# Next Plugin Repo Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a public, permanently-reachable Cloudflare Worker that serves `revenge-next-plugs`' built plugin zips + a generated `index.json` at `https://next.jarviscli.dev`, redeployed automatically on every push to `main`, so Revenge Next on the phone can install/update plugins without any dependency on this sandbox.

**Architecture:** GitHub Actions builds the JS bundles and plugin zips using the repo's existing, already-working toolchain (`bun run build`, `./gradlew packageAllPlugins`), generates a static `index.json` pointing at `https://next.jarviscli.dev`, and deploys both as static assets via an assets-only Cloudflare Worker (`wrangler deploy`). No application code, no database — pure static hosting plus CI wiring.

**Tech Stack:** GitHub Actions, Cloudflare Workers (Static Assets), Wrangler, Bun, Gradle/JDK 25, `@revenge-mod/plugin-cli`.

## Global Constraints

- Repo: new, public, `everestmcarthur/revenge-next-plugs` — not a fork, not from a template.
- Custom domain: `next.jarviscli.dev` (zone `jarviscli.dev`, Cloudflare account `dc5e308f1df2d6bb5082951d3f3993a5`).
- Worker name: `revenge-next-plugs`.
- Deploy auth: `CLOUDFLARE_API_TOKEN` (scoped token), not the legacy `CLOUDFLARE_API_KEY`/`CLOUDFLARE_EMAIL` pair Classic's `revenge-plugins` uses.
- No D1, KV, or Durable Objects in this phase — assets-only Worker.
- Reuse existing build tooling exactly as-is; do not duplicate packaging logic in a custom script.
- Local default branch renamed `master` → `main` before first push (workflow triggers on `main`).

---

### Task 1: Import the working tree as the repo's real history

**Files:**
- Modify: none (staging existing untracked files)
- No test file — verified via `git log`/`git status`

**Interfaces:**
- Produces: a `main` branch with the full current working tree committed, ready to push in Task 2.

- [ ] **Step 1: Rename the local branch to `main`**

Run: `cd /root/revenge-next-plugs && git branch -m master main`
Expected: no output; `git branch` shows `* main`.

- [ ] **Step 2: Stage the untracked project files**

Run:
```bash
cd /root/revenge-next-plugs
git add .gitignore .vscode LICENSE README.md biome.json build.gradle.kts \
  gradle.properties gradle gradlew gradlew.bat package.json plugins \
  repo.config.json settings.gradle.kts tsconfig.json types
git status --short
```
Expected: every line starts with `A ` (added), nothing starts with `??`. `.gitignore` already excludes `node_modules/`, `build/`, `plugins/*/build/`, and the lockfiles, so no generated/vendored files should appear in the list.

- [ ] **Step 3: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
Import revenge-next-plugs working tree

Includes the already-applied package.json fix (build/build:dev/generate-index/serve
now invoke @revenge-mod/plugin-cli via bun directly, bypassing its broken
node-shebang delegation that crashed both bun run build and Gradle's
packageAllPlugins).
EOF
)"
git log --oneline
```
Expected: two commits total on `main` — this one, and the earlier `Add Phase 1 design doc: Next plugin repo hosting` root commit.

---

### Task 2: Create the GitHub repo and push

**Files:** none

**Interfaces:**
- Consumes: `main` branch from Task 1.
- Produces: `origin` remote pointing at `https://github.com/everestmcarthur/revenge-next-plugs`, with `main` pushed. Later tasks push directly to this remote.

- [ ] **Step 1: Create the repo (public, no fork/template) and add it as `origin`**

Run: `cd /root/revenge-next-plugs && gh repo create everestmcarthur/revenge-next-plugs --public --source=. --remote=origin --description "Revenge Next plugin repository"`
Expected: prints the new repo URL; `git remote -v` now shows `origin` pointing at `github.com/everestmcarthur/revenge-next-plugs`.

- [ ] **Step 2: Push**

Run: `git push -u origin main`
Expected: push succeeds; `main` is now the repo's default branch on GitHub (confirm with `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`, expect `main`).

---

### Task 3: Wire up the Cloudflare deploy token

**Files:** none (GitHub repo secret, not a file in the tree)

**Interfaces:**
- Produces: a `CLOUDFLARE_API_TOKEN` secret on the GitHub repo, consumed by the workflow added in Task 5.

- [ ] **Step 1: Ask the user for the Cloudflare API token and set it as a repo secret**

Ask the user to paste the scoped Cloudflare API token they mentioned (the one replacing Classic's `CLOUDFLARE_API_KEY`/`CLOUDFLARE_EMAIL` method). Run:

`gh secret set CLOUDFLARE_API_TOKEN --repo everestmcarthur/revenge-next-plugs`

Paste the token at the interactive prompt — do not pass it as a `--body` CLI argument or otherwise put it directly in a shell command, since that would leak it into shell history.

- [ ] **Step 2: Verify the secret exists**

Run: `gh secret list --repo everestmcarthur/revenge-next-plugs`
Expected: `CLOUDFLARE_API_TOKEN` appears in the list (value itself is never shown, only the name and update time).

---

### Task 4: Add the Worker config

**Files:**
- Create: `wrangler.toml`

**Interfaces:**
- Consumes: `build/dist/` (produced at CI time by Task 5's workflow, not present in the repo itself — `build/` is gitignored).
- Produces: the Worker configuration Task 5's `wrangler deploy` step reads.

- [ ] **Step 1: Create `wrangler.toml`**

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

- [ ] **Step 2: Verify the file is well-formed**

Run: `cd /root/revenge-next-plugs && bunx wrangler deploy --dry-run --outdir /tmp/wrangler-dry-run`
Expected: prints a bundling/config summary with no config-parse errors (it will still fail or warn about missing assets, since `build/dist` doesn't exist locally yet at this point — that's fine, this step only checks `wrangler.toml` itself parses and the `[[routes]]`/`account_id` fields are accepted). Full end-to-end validation happens in Task 5/6 once the real build output exists and deploy runs for real.

- [ ] **Step 3: Commit and push**

```bash
git add wrangler.toml
git commit -m "Add wrangler.toml: assets-only Worker on next.jarviscli.dev"
git push
```

---

### Task 5: Add the deploy workflow and verify a live run

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `wrangler.toml` (Task 4), `CLOUDFLARE_API_TOKEN` secret (Task 3), existing `bun run build` / `./gradlew packageAllPlugins` / `bun run generate-index` commands (already working, verified locally this session — no changes needed).
- Produces: `build/dist/*.zip` + `build/dist/index.json` deployed live at `https://next.jarviscli.dev` on every push to `main`.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Build and deploy

on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest

        steps:
            - uses: actions/checkout@v4

            - name: Set up Bun
              uses: oven-sh/setup-bun@v2

            - name: Set up JDK 25
              uses: actions/setup-java@v4
              with:
                  distribution: "temurin"
                  java-version: "25"

            - name: Install JS deps
              run: bun install

            - name: Package all plugins
              run: ./gradlew packageAllPlugins

            - name: Generate repository index
              run: bun run generate-index -- --dist build/dist --base-url https://next.jarviscli.dev --out build/dist/index.json

            - name: Deploy to Cloudflare Workers
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
              run: bunx wrangler deploy
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions workflow: build, package, and deploy to Cloudflare Workers"
git push
```

- [ ] **Step 3: Watch the triggered run to completion**

Run: `gh run watch --repo everestmcarthur/revenge-next-plugs $(gh run list --repo everestmcarthur/revenge-next-plugs --branch main --limit 1 --json databaseId -q '.[0].databaseId')`
Expected: run finishes with conclusion `success`. If it fails, read the failing step's log (`gh run view --repo everestmcarthur/revenge-next-plugs --log-failed`) before making any change — this is a fresh CI environment (no local Bun cache, no local Gradle daemon), so first-run failures are more likely to be environment differences (e.g. a missing JDK version match) than logic bugs; don't guess-fix, check the actual log.

---

### Task 6: Verify the live deployment

**Files:** none

**Interfaces:**
- Consumes: the live deployment from Task 5.

- [ ] **Step 1: Confirm the index is reachable and valid**

Run: `curl -sf https://next.jarviscli.dev/index.json | bun -e "const d = JSON.parse(await Bun.stdin.text()); console.log(Object.keys(d.plugins ?? d).join(', '))"`
Expected: prints plugin IDs including `dev.everestmcarthur.staff-tags` and `dev.everestmcarthur.next-eval-checks`. No TLS/DNS errors (confirms Wrangler's automatic cert issuance for the custom domain succeeded).

- [ ] **Step 2: Confirm a zip artifact downloads and its sha256 matches what the index claims**

Run:
```bash
bun -e "
const idx = await (await fetch('https://next.jarviscli.dev/index.json')).json();
const [id, plugin] = Object.entries(idx.plugins)[0];
const version = plugin.channels.latest;
const v = plugin.versions[version];
const buf = await (await fetch(v.url)).arrayBuffer();
const hash = Buffer.from(await crypto.subtle.digest('SHA-256', buf)).toString('hex');
console.log(id, version, hash === v.sha256 ? 'sha256 OK' : \`MISMATCH: expected \${v.sha256} got \${hash}\`);
"
```
Expected: prints `sha256 OK`.

---

### Task 7: Reinstall staff-tags on-device and resume the deferred test

**Files:** none — this task is executed by the user on their phone, not by an agent.

**Interfaces:**
- Consumes: the live repo from Task 6.

- [ ] **Step 1: Give the user the exact on-device steps**

Tell the user:
1. In Revenge Next, go to plugin settings and add `https://next.jarviscli.dev` as a repository (bare URL, no `/index.json` suffix — the app fetches that itself).
2. Install/reinstall `Staff Tags` from that repository.
3. Send a chat message as the owner of a server you own (same test from the earlier debugging session, now against a build that actually contains the already-fixed `getTagProperties` patch).

- [ ] **Step 2: Record the result**

Ask the user to report what happened. If a tag now appears in chat: the repo-hosting phase is done and fully verified end-to-end, and the remaining known bugs (`HeaderName`/`DisplayName`/`UserRow` lookups in `name.tsx`/`details.tsx`) are the next, separate debugging task. If no tag appears even now: stop and return to `superpowers:systematic-debugging` rather than guessing — the stale-build hypothesis would be falsified and there's a still-undiagnosed bug in the chat.ts path itself.
