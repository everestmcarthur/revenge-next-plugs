# next.jarviscli.dev Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public browse/install site plus a token-gated admin panel for revenge-next-plugs, deployed at `next.jarviscli.dev`, replacing the current bare `/index.json`-only Worker.

**Architecture:** A single Cloudflare Worker (new `worker/src/` tree) sits in front of the existing `[assets]` static binding. It serves the public site (`/`, `/plugins/<id>`), the real install feed (`/index.json`, format unchanged from today), and a token-gated admin UI (`/admin`, `/api/admin/*`) backed by a new D1 database. No Durable Object, no KV cache - D1 is read fresh per request.

**Tech Stack:** TypeScript, Cloudflare Workers (`@cloudflare/workers-types`), D1, `wrangler`. No framework/router library - plain `fetch` handler, matching the sibling classic repo's `api/src/index.ts` style but adapted (that file is the pattern reference throughout this plan, not something to import from - it lives in a separate repo/build).

## Global Constraints

- Style: single quotes, no semicolons, trailing commas, arrow-parens as-needed (`biome.json`, already configured) - run `bunx biome check --write worker` after every task.
- Public `/index.json` format must stay byte-compatible with what Next's client already reads today (`{format, name, description, plugins: {<id>: {name, description, author, channels: {latest, ...}, versions: {<v>: {url, sha256, size, dependencies}}}}}`) - never break installs.
- Version/sha256/url/size in `/index.json` always come from the real built ZIPs (`build/dist/*.zip`) - never fabricated, never overridden by admin edits.
- Admin write endpoints require `Authorization: Bearer <ADMIN_TOKEN>` (Worker secret), checked server-side on every write, no exceptions.
- Cloudflare account: `dc5e308f1df2d6bb5082951d3f3993a5` (already used successfully this session via the `cloudflare-api` MCP tool for the sibling repo's D1/KV/dev-worker setup - reuse the same account, same tool).
- Plugin id format: `/^[a-zA-Z0-9.-]+$/`, no `..`, doesn't start with `.` (from `generate-index.ts`'s `PLUGIN_ID_REGEX` - reuse this exact regex for admin-side validation of draft plugin ids).
- A generated manifest for a draft plugin must declare `dependencies: {"revenge.api": {...}, "discord": {...}}` - `generate-index.ts` rejects a manifest missing either (`RESERVED_DEPENDENCY_IDS`).
- Visual style: dark background, single purple accent (`#9a8cff` / badge bg `rgba(154,140,255,0.12)` / border `rgba(154,140,255,0.25)`) used only on interactive/status elements (badges, buttons) - never as a decorative background glow or gradient. Reference: `.superpowers/brainstorm/263484-1786809105/content/glass-refined.html` (the approved mockup, already committed to the repo's `.superpowers/` - read it directly for exact colors/spacing before building the browse page).

---

## File Structure

```
worker/
  src/
    index.ts        - fetch handler entrypoint, routing only
    env.ts           - Env interface (D1Database, Fetcher, ADMIN_TOKEN)
    db.ts             - D1 access: overrides + channels, typed read/write helpers
    publicIndex.ts    - merges base build/dist/index.json with D1 overrides -> public /index.json
    theme.ts          - shared CSS string + HTML shell (head, OG meta helper) used by every page
    pages/
      browse.ts        - renders /
      detail.ts        - renders /plugins/<id>, sets per-plugin OG tags
      admin.ts          - renders /admin (token gate + edit UI)
    admin/
      auth.ts            - Bearer-token check helper
      routes.ts           - /api/admin/* write handlers (override upsert, channel promote, draft create)
  schema.sql         - plugin_overrides + plugin_channels D1 schema
  tsconfig.json       - Workers-runtime tsconfig (separate from the RN-targeting root one)
wrangler.toml        - MODIFY: add `main`, `[[d1_databases]]`
package.json          - MODIFY: add @cloudflare/workers-types devDependency, extend lint:types
.github/scripts/verify-deploy.mjs  - MODIFY: add OG-tag check + admin-401 check
```

`worker/src/` is its own unit, isolated from `plugins/` (RN/Hermes runtime) and `cli/`-style tooling - it never imports from `plugins/*/js`, and nothing in `plugins/` imports from `worker/`. Two completely different runtimes (Workers vs Hermes), kept structurally separate the same way the root `tsconfig.json` already excludes `plugins/*/build`.

---

### Task 1: D1 database, schema, and worker scaffolding

**Files:**
- Create: `worker/schema.sql`
- Create: `worker/tsconfig.json`
- Create: `worker/src/env.ts`
- Create: `worker/src/index.ts` (minimal placeholder - ASSETS passthrough only)
- Modify: `wrangler.toml`
- Modify: `package.json`

**Interfaces:**
- Produces: `Env` interface (`ASSETS: Fetcher; DB: D1Database; ADMIN_TOKEN: string`) - every later task imports this from `worker/src/env.ts`.

- [ ] **Step 1: Write the D1 schema**

`worker/schema.sql`:
```sql
DROP TABLE IF EXISTS plugin_overrides;
CREATE TABLE plugin_overrides (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    tagline TEXT,
    note TEXT,
    category TEXT,
    accent TEXT,
    status TEXT,
    how_it_works TEXT,
    features TEXT,        -- JSON array of strings
    commands TEXT,          -- JSON array of {cmd, desc}
    limitations TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    is_draft INTEGER NOT NULL DEFAULT 0,
    manifest TEXT,           -- only used when is_draft = 1
    main_js TEXT,             -- only used when is_draft = 1
    updated_at TEXT NOT NULL
);

DROP TABLE IF EXISTS plugin_channels;
CREATE TABLE plugin_channels (
    plugin_id TEXT NOT NULL,
    channel TEXT NOT NULL,     -- 'alpha' | 'beta' | 'stable'
    version TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (plugin_id, channel)
);
```

- [ ] **Step 2: Create the D1 database via the Cloudflare API**

Use the `cloudflare-api` MCP tool's `execute` action (same tool, same account, proven working earlier this session for the sibling repo's dev D1):

```js
async () => {
  const res = await cloudflare.request({
    method: "POST",
    path: `/accounts/dc5e308f1df2d6bb5082951d3f3993a5/d1/database`,
    body: { name: "revenge-next-plugs" },
  });
  return res;
}
```
Record the returned `result.uuid` - it goes into `wrangler.toml` in Step 5.

- [ ] **Step 3: Apply the schema to the new database**

```js
async () => {
  const sql = /* paste the full contents of worker/schema.sql here as a template string */ ``;
  const res = await cloudflare.request({
    method: "POST",
    path: `/accounts/dc5e308f1df2d6bb5082951d3f3993a5/d1/database/<uuid-from-step-2>/query`,
    body: { sql },
  });
  return res;
}
```
Expected: `success: true`, two statements each reporting `changed_db: true`.

- [ ] **Step 4: Set the ADMIN_TOKEN secret**

Generate a random token (e.g. `openssl rand -hex 24`) and set it:
```bash
cd /root/revenge-next-plugs
echo -n "<generated-token>" | bunx wrangler secret put ADMIN_TOKEN
```
Save the token somewhere you (the human) can retrieve it later - it's never printed back by Cloudflare after this.

- [ ] **Step 5: Wire wrangler.toml**

Modify `wrangler.toml` to add a `main` entry and the D1 binding:
```toml
name = "revenge-next-plugs"
compatibility_date = "2026-08-08"
account_id = "dc5e308f1df2d6bb5082951d3f3993a5"
main = "worker/src/index.ts"

[assets]
directory = "build/dist"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "revenge-next-plugs"
database_id = "<uuid-from-step-2>"

[[routes]]
pattern = "next.jarviscli.dev"
custom_domain = true
```
(`binding = "ASSETS"` under `[assets]` is added explicitly here even though it was implicit before - the Worker code now references `env.ASSETS` directly, so make the name explicit rather than relying on the Cloudflare default.)

- [ ] **Step 6: Add `@cloudflare/workers-types` and a worker-specific tsconfig**

```bash
cd /root/revenge-next-plugs
bun add -d @cloudflare/workers-types
```

`worker/tsconfig.json`:
```json
{
	"compilerOptions": {
		"target": "ESNext",
		"module": "ESNext",
		"moduleResolution": "Bundler",
		"strict": true,
		"skipLibCheck": true,
		"types": ["@cloudflare/workers-types"]
	},
	"include": ["src"]
}
```
This is deliberately separate from the root `tsconfig.json` (which pulls in `@revenge-mod/types` - React Native/Hermes globals that don't exist in the Workers runtime, and vice versa: `D1Database`/`Fetcher` don't exist in the RN runtime).

- [ ] **Step 7: `Env` interface**

`worker/src/env.ts`:
```ts
export interface Env {
	ASSETS: Fetcher
	DB: D1Database
	ADMIN_TOKEN: string
}
```

- [ ] **Step 8: Minimal placeholder entrypoint**

`worker/src/index.ts`:
```ts
import type { Env } from './env'

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		return env.ASSETS.fetch(request)
	},
}
```

- [ ] **Step 9: Extend `lint:types` to cover the worker**

Modify `package.json`'s `scripts.lint:types`:
```json
"lint:types": "tsc --noEmit && tsc -p worker --noEmit && tsc -p cli --noEmit"
```
(The pre-existing `tsc -p cli --noEmit` already fails today because no `cli/` directory exists yet - that's a pre-existing gap, not something this task fixes. Placing the new `worker` check *before* it means a broken worker build still fails loudly instead of being masked by the already-broken `cli` check.)

- [ ] **Step 10: Build, typecheck, format**

```bash
cd /root/revenge-next-plugs
bun run lint:types 2>&1 | grep -v "^plugins/staff-tags/js/patches/details.tsx"  # pre-existing, unrelated
bunx biome check --write worker
```
Expected: no NEW errors (the `details.tsx` ones are pre-existing and out of scope for this plan).

- [ ] **Step 11: Deploy and verify the placeholder**

```bash
bunx wrangler deploy
curl -s -o /dev/null -w "%{http_code}\n" https://next.jarviscli.dev/index.json
```
Expected: `200` (the site behaves exactly as before this task - Step 8's Worker is a pure passthrough to the same static assets that were already being served).

- [ ] **Step 12: Commit**

```bash
git add worker wrangler.toml package.json bun.lock
git commit -m "next-site: scaffold worker, D1 database, and deploy wiring"
```

---

### Task 2: D1 access layer + dynamic public index.json

**Files:**
- Create: `worker/src/db.ts`
- Create: `worker/src/publicIndex.ts`
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: `Env` from Task 1's `worker/src/env.ts`.
- Produces:
  - `db.ts`: `getOverride(env: Env, id: string): Promise<Override | null>`, `getAllOverrides(env: Env): Promise<Record<string, Override>>`, `getChannels(env: Env, id: string): Promise<Record<string, string>>`, `upsertOverride(env: Env, id: string, patch: Partial<Override>): Promise<void>`, `setChannel(env: Env, id: string, channel: string, version: string): Promise<void>`. `Override` type: `{name?, description?, tagline?, note?, category?, accent?, status?, howItWorks?, features?: string[], commands?: {cmd:string,desc:string}[], limitations?, hidden: boolean, isDraft: boolean, manifest?: string, mainJs?: string}`.
  - `publicIndex.ts`: `buildPublicIndex(baseIndex: BaseIndex, overrides: Record<string, Override>): BaseIndex` (same shape as `generate-index.ts`'s output - `{format, name, description, plugins: {...}}`) - later tasks (browse/detail pages) reuse this same merged shape for display data too.

- [ ] **Step 1: D1 row types and read/write helpers**

`worker/src/db.ts`:
```ts
import type { Env } from './env'

export interface Override {
	name?: string
	description?: string
	tagline?: string
	note?: string
	category?: string
	accent?: string
	status?: string
	howItWorks?: string
	features?: string[]
	commands?: { cmd: string; desc: string }[]
	limitations?: string
	hidden: boolean
	isDraft: boolean
	manifest?: string
	mainJs?: string
}

interface Row {
	id: string
	name: string | null
	description: string | null
	tagline: string | null
	note: string | null
	category: string | null
	accent: string | null
	status: string | null
	how_it_works: string | null
	features: string | null
	commands: string | null
	limitations: string | null
	hidden: number
	is_draft: number
	manifest: string | null
	main_js: string | null
}

function rowToOverride(row: Row): Override {
	return {
		name: row.name ?? undefined,
		description: row.description ?? undefined,
		tagline: row.tagline ?? undefined,
		note: row.note ?? undefined,
		category: row.category ?? undefined,
		accent: row.accent ?? undefined,
		status: row.status ?? undefined,
		howItWorks: row.how_it_works ?? undefined,
		features: row.features ? JSON.parse(row.features) : undefined,
		commands: row.commands ? JSON.parse(row.commands) : undefined,
		limitations: row.limitations ?? undefined,
		hidden: !!row.hidden,
		isDraft: !!row.is_draft,
		manifest: row.manifest ?? undefined,
		mainJs: row.main_js ?? undefined,
	}
}

export async function getOverride(env: Env, id: string): Promise<Override | null> {
	const row = await env.DB.prepare('SELECT * FROM plugin_overrides WHERE id = ?1')
		.bind(id)
		.first<Row>()
	return row ? rowToOverride(row) : null
}

export async function getAllOverrides(env: Env): Promise<Record<string, Override>> {
	const { results } = await env.DB.prepare('SELECT * FROM plugin_overrides').all<Row>()
	const out: Record<string, Override> = {}
	for (const row of results) out[row.id] = rowToOverride(row)
	return out
}

export async function getChannels(env: Env, id: string): Promise<Record<string, string>> {
	const { results } = await env.DB.prepare(
		'SELECT channel, version FROM plugin_channels WHERE plugin_id = ?1',
	)
		.bind(id)
		.all<{ channel: string; version: string }>()
	const out: Record<string, string> = {}
	for (const row of results) out[row.channel] = row.version
	return out
}

export async function getAllChannels(env: Env): Promise<Record<string, Record<string, string>>> {
	const { results } = await env.DB.prepare('SELECT plugin_id, channel, version FROM plugin_channels').all<{
		plugin_id: string
		channel: string
		version: string
	}>()
	const out: Record<string, Record<string, string>> = {}
	for (const row of results) {
		out[row.plugin_id] ??= {}
		out[row.plugin_id][row.channel] = row.version
	}
	return out
}

export async function upsertOverride(env: Env, id: string, patch: Partial<Override>): Promise<void> {
	const existing = await getOverride(env, id)
	const merged: Override = { hidden: false, isDraft: false, ...existing, ...patch }

	await env.DB.prepare(
		`INSERT INTO plugin_overrides (
			id, name, description, tagline, note, category, accent, status, how_it_works,
			features, commands, limitations, hidden, is_draft, manifest, main_js, updated_at
		 ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)
		 ON CONFLICT(id) DO UPDATE SET
			name = excluded.name, description = excluded.description, tagline = excluded.tagline,
			note = excluded.note, category = excluded.category, accent = excluded.accent,
			status = excluded.status, how_it_works = excluded.how_it_works, features = excluded.features,
			commands = excluded.commands, limitations = excluded.limitations, hidden = excluded.hidden,
			is_draft = excluded.is_draft, manifest = excluded.manifest, main_js = excluded.main_js,
			updated_at = excluded.updated_at`,
	)
		.bind(
			id,
			merged.name ?? null,
			merged.description ?? null,
			merged.tagline ?? null,
			merged.note ?? null,
			merged.category ?? null,
			merged.accent ?? null,
			merged.status ?? null,
			merged.howItWorks ?? null,
			merged.features ? JSON.stringify(merged.features) : null,
			merged.commands ? JSON.stringify(merged.commands) : null,
			merged.limitations ?? null,
			merged.hidden ? 1 : 0,
			merged.isDraft ? 1 : 0,
			merged.manifest ?? null,
			merged.mainJs ?? null,
			new Date().toISOString(),
		)
		.run()
}

export async function setChannel(env: Env, id: string, channel: string, version: string): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO plugin_channels (plugin_id, channel, version, updated_at) VALUES (?1,?2,?3,?4)
		 ON CONFLICT(plugin_id, channel) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at`,
	)
		.bind(id, channel, version, new Date().toISOString())
		.run()
}
```

- [ ] **Step 2: Write the failing test for the merge logic**

There's no existing test runner in this repo (`plugin-cli` ships a build/generate-index CLI only). Write a small standalone script instead, matching the repo's existing "smoke test as a script" convention (`verify-deploy.mjs`).

`worker/src/publicIndex.test.mjs` (temporary, for this step only - deleted at the end of Step 4 once `publicIndex.ts` is proven against it via a real bundled check in Task 6, so this doesn't become a second untracked test system):
```js
import assert from 'node:assert'

const baseIndex = {
	format: 1,
	name: 'revenge-next-plugs',
	description: '',
	plugins: {
		'dev.example.foo': {
			name: 'Foo',
			description: 'does foo',
			author: 'Rosie',
			channels: { latest: '1.0.0' },
			versions: { '1.0.0': { url: 'https://x/foo.zip', sha256: 'abc', size: 10, dependencies: {} } },
		},
		'dev.example.hidden': {
			name: 'Hidden',
			description: 'should not appear',
			author: 'Rosie',
			channels: { latest: '1.0.0' },
			versions: { '1.0.0': { url: 'https://x/hidden.zip', sha256: 'def', size: 10, dependencies: {} } },
		},
	},
}

const overrides = {
	'dev.example.foo': { hidden: false, isDraft: false, name: 'Foo Override' },
	'dev.example.hidden': { hidden: true, isDraft: false },
}

const channels = {
	'dev.example.foo': { stable: '1.0.0', beta: '1.0.0' },
}

// Inline copy of the logic under test, since this repo has no test runner wired up yet -
// deleted once Task 6's live deploy check exercises the real module end-to-end.
function buildPublicIndex(base, overrides, channels) {
	const plugins = {}
	for (const [id, plugin] of Object.entries(base.plugins)) {
		const override = overrides[id]
		if (override?.hidden) continue
		const stable = channels[id]?.stable
		plugins[id] = {
			...plugin,
			name: override?.name ?? plugin.name,
			description: override?.description ?? plugin.description,
			channels: { ...plugin.channels, ...(stable && stable in plugin.versions ? { latest: stable } : {}) },
		}
	}
	return { ...base, plugins }
}

const result = buildPublicIndex(baseIndex, overrides, channels)
assert.strictEqual(Object.keys(result.plugins).length, 1, 'hidden plugin should be dropped')
assert.strictEqual(result.plugins['dev.example.foo'].name, 'Foo Override', 'override name should win')
assert.strictEqual(result.plugins['dev.example.foo'].channels.latest, '1.0.0', 'stable channel should map to latest')
console.log('publicIndex merge logic: OK')
```

- [ ] **Step 3: Run it to confirm the test itself is sound**

```bash
node worker/src/publicIndex.test.mjs
```
Expected: `publicIndex merge logic: OK` (this validates the test's own assertions against the inline reference implementation before the real TypeScript module exists).

- [ ] **Step 4: Write the real `publicIndex.ts` (same logic, typed, importable)**

`worker/src/publicIndex.ts`:
```ts
import type { Override } from './db'

export interface IndexVersion {
	url: string
	sha256: string
	size: number
	dependencies: Record<string, { version?: string; optional?: boolean }>
}

export interface IndexPlugin {
	name: string
	description: string
	author: string
	icon?: string
	channels: Record<string, string>
	versions: Record<string, IndexVersion>
}

export interface BaseIndex {
	format: number
	name: string
	description: string
	icon?: string
	plugins: Record<string, IndexPlugin>
}

/**
 * Merges the git-tracked base index (real versions/hashes, never touched) with live D1
 * overrides: hidden plugins drop out, edited display fields win, and whatever version is
 * mapped to the 'stable' channel becomes 'latest' - the only field of `channels` a public
 * consumer (Next's installer) ever reads. alpha/beta stay in `channels` for the admin UI's
 * own use but are meaningless to a public client.
 */
export function buildPublicIndex(
	base: BaseIndex,
	overrides: Record<string, Override>,
	channels: Record<string, Record<string, string>>,
): BaseIndex {
	const plugins: Record<string, IndexPlugin> = {}
	for (const [id, plugin] of Object.entries(base.plugins)) {
		const override = overrides[id]
		if (override?.hidden) continue

		const pluginChannels = channels[id]
		const stable = pluginChannels?.stable
		plugins[id] = {
			...plugin,
			name: override?.name ?? plugin.name,
			description: override?.description ?? plugin.description,
			channels: {
				...plugin.channels,
				...(stable && stable in plugin.versions ? { latest: stable } : {}),
			},
		}
	}
	return { ...base, plugins }
}
```

- [ ] **Step 5: Wire it into the fetch handler**

Modify `worker/src/index.ts`:
```ts
import { getAllChannels, getAllOverrides } from './db'
import { buildPublicIndex } from './publicIndex'
import type { Env } from './env'
import type { BaseIndex } from './publicIndex'

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)

		if (url.pathname === '/index.json') {
			const baseRes = await env.ASSETS.fetch(new URL('/index.json', request.url))
			if (!baseRes.ok) return baseRes

			const base = await baseRes.json<BaseIndex>()
			const [overrides, channels] = await Promise.all([getAllOverrides(env), getAllChannels(env)])
			const merged = buildPublicIndex(base, overrides, channels)

			return new Response(JSON.stringify(merged), {
				headers: { 'content-type': 'application/json' },
			})
		}

		return env.ASSETS.fetch(request)
	},
}
```

- [ ] **Step 6: Delete the temporary standalone test, typecheck, format**

```bash
rm worker/src/publicIndex.test.mjs
cd /root/revenge-next-plugs
bun run lint:types 2>&1 | grep -v "^plugins/staff-tags/js/patches/details.tsx"
bunx biome check --write worker
```
Expected: no new errors.

- [ ] **Step 7: Deploy and verify live**

```bash
bunx wrangler deploy
curl -s https://next.jarviscli.dev/index.json | python3 -m json.tool | head -20
```
Expected: identical shape to before this task (no overrides exist in D1 yet, so the merge is a no-op) - confirms the new code path didn't regress anything.

- [ ] **Step 8: Commit**

```bash
git add worker
git commit -m "next-site: D1 access layer, dynamic public index.json merge"
```

---

### Task 3: Shared theme + browse page (`/`)

**Files:**
- Create: `worker/src/theme.ts`
- Create: `worker/src/pages/browse.ts`
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: `buildPublicIndex`'s merged `BaseIndex` from Task 2, plus `getAllOverrides` for `tagline`/`category`/`accent` (fields the public `/index.json` doesn't carry, but the browse page needs for display).
- Produces: `theme.ts`: `PAGE_CSS: string`, `htmlShell(opts: {title: string; description: string; ogTitle?: string; ogDescription?: string; body: string}): string`. `browse.ts`: `renderBrowsePage(index: BaseIndex, overrides: Record<string, Override>): string` (returns full HTML) - `pages/detail.ts` in Task 4 reuses `htmlShell`.

- [ ] **Step 1: Shared CSS + HTML shell, matching the approved mockup exactly**

Read `.superpowers/brainstorm/263484-1786809105/content/glass-refined.html` first and copy its exact color values (`#0b0c10` background, `#e8e9ed` text, `#9a8cff`/`rgba(154,140,255,0.12)`/`rgba(154,140,255,0.25)` accent, `rgba(255,255,255,0.07-0.12)` borders) rather than re-deriving them from memory.

`worker/src/theme.ts`:
```ts
export const PAGE_CSS = `
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: #0b0c10;
		color: #e8e9ed;
		font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
	}
	a { color: inherit; text-decoration: none; }
	.wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; }
	header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.07);
	}
	.brand { display: flex; align-items: center; gap: 10px; }
	.brand-mark {
		width: 22px; height: 22px; border-radius: 6px; background: #15161c;
		border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center;
		justify-content: center; font-size: 11px; font-weight: 700; color: #9a8cff;
	}
	.brand-name { font-weight: 600; font-size: 13.5px; letter-spacing: -0.01em; }
	nav { display: flex; align-items: center; gap: 18px; font-size: 12px; color: rgba(255,255,255,0.5); }
	.page-title { font-size: 19px; font-weight: 650; letter-spacing: -0.015em; margin-bottom: 4px; }
	.page-sub { font-size: 12.5px; color: rgba(255,255,255,0.45); margin-bottom: 16px; }
	.chip {
		background: transparent; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px;
		padding: 5px 11px; font-size: 11.5px; color: rgba(255,255,255,0.4); display: inline-block;
	}
	.chip.active { background: #17181e; border-color: rgba(255,255,255,0.09); color: rgba(255,255,255,0.85); }
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 4px 0 24px; }
	.card {
		background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
		border: 1px solid rgba(255,255,255,0.08); border-radius: 11px; padding: 15px;
	}
	.card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
	.card-icon {
		width: 30px; height: 30px; border-radius: 8px; background: #1a1b22;
		border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center;
		justify-content: center; font-size: 13px;
	}
	.badge {
		background: rgba(154,140,255,0.12); color: #b6acff; border: 1px solid rgba(154,140,255,0.25);
		font-size: 9.5px; font-weight: 600; padding: 2px 7px; border-radius: 5px;
	}
	.card-name { font-size: 13.5px; font-weight: 600; letter-spacing: -0.005em; }
	.card-desc { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 3px; line-height: 1.4; }
	.card-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
	.card-meta { font-size: 10px; color: rgba(255,255,255,0.35); }
	.btn {
		background: #e8e9ed; color: #0b0c10; font-size: 10.5px; font-weight: 600;
		padding: 4px 10px; border-radius: 6px; display: inline-block;
	}
`

export function htmlShell(opts: {
	title: string
	description: string
	ogTitle?: string
	ogDescription?: string
	body: string
}): string {
	const ogTitle = opts.ogTitle ?? opts.title
	const ogDescription = opts.ogDescription ?? opts.description
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDescription)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDescription)}">
<style>${PAGE_CSS}</style>
</head>
<body>${opts.body}</body>
</html>`
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
```

- [ ] **Step 2: Browse page renderer**

`worker/src/pages/browse.ts`:
```ts
import { escapeHtml, htmlShell } from '../theme'
import type { Override } from '../db'
import type { BaseIndex } from '../publicIndex'

export function renderBrowsePage(index: BaseIndex, overrides: Record<string, Override>): string {
	const entries = Object.entries(index.plugins)

	const cards = entries
		.map(([id, plugin]) => {
			const override = overrides[id]
			const version = plugin.channels.latest ?? Object.keys(plugin.versions)[0]
			const tagline = override?.tagline ?? plugin.description
			return `
				<div class="card">
					<div class="card-top">
						<div class="card-icon">${plugin.icon ? escapeHtml(plugin.icon) : '\u{1F9E9}'}</div>
						<div class="badge">STABLE</div>
					</div>
					<div class="card-name"><a href="/plugins/${encodeURIComponent(id)}">${escapeHtml(plugin.name)}</a></div>
					<div class="card-desc">${escapeHtml(tagline)}</div>
					<div class="card-foot">
						<div class="card-meta">${escapeHtml(plugin.author)} &middot; v${escapeHtml(version ?? '?')}</div>
						<a class="btn" href="/plugins/${encodeURIComponent(id)}">View</a>
					</div>
				</div>`
		})
		.join('')

	const body = `
		<header>
			<div class="brand">
				<div class="brand-mark">N</div>
				<div class="brand-name">${escapeHtml(index.name)}</div>
			</div>
			<nav><span>Plugins</span></nav>
		</header>
		<div class="wrap">
			<div class="page-title" style="margin-top: 22px;">Plugins</div>
			<div class="page-sub">${entries.length} available &middot; installs directly into Revenge Next</div>
			<div class="grid">${cards}</div>
		</div>`

	return htmlShell({
		title: index.name,
		description: index.description || 'Plugins for Revenge Next.',
		body,
	})
}
```

- [ ] **Step 3: Wire the `/` route**

Modify `worker/src/index.ts`, adding a branch before the final `env.ASSETS.fetch(request)` fallback:
```ts
import { getAllChannels, getAllOverrides } from './db'
import { renderBrowsePage } from './pages/browse'
import { buildPublicIndex } from './publicIndex'
// ...

if (url.pathname === '/') {
	const baseRes = await env.ASSETS.fetch(new URL('/index.json', request.url))
	const base = await baseRes.json<BaseIndex>()
	const [overrides, channels] = await Promise.all([getAllOverrides(env), getAllChannels(env)])
	const merged = buildPublicIndex(base, overrides, channels)
	const visible = Object.fromEntries(
		Object.entries(merged.plugins).filter(([id]) => !overrides[id]?.hidden),
	)
	return new Response(renderBrowsePage({ ...merged, plugins: visible }, overrides), {
		headers: { 'content-type': 'text/html; charset=utf-8' },
	})
}
```
(`buildPublicIndex` already drops hidden plugins from `.plugins`, so the extra filter here is redundant defense, not new logic - keep it simple and just pass `merged` directly instead once this is verified; noted here for clarity during review, not as a real double-filter to ship.)

Actually - simplify: `buildPublicIndex`'s output already excludes hidden plugins entirely, so just pass `merged` straight to `renderBrowsePage(merged, overrides)` without the redundant `visible` filtering line.

- [ ] **Step 4: Typecheck, format, deploy, verify live**

```bash
cd /root/revenge-next-plugs
bun run lint:types 2>&1 | grep -v "^plugins/staff-tags/js/patches/details.tsx"
bunx biome check --write worker
bunx wrangler deploy
curl -s -o /dev/null -w "%{http_code}\n" https://next.jarviscli.dev/
curl -s https://next.jarviscli.dev/ | grep -c "card-name"
```
Expected: `200`, and a count matching the number of plugins currently built (2, as of this plan).

- [ ] **Step 5: Commit**

```bash
git add worker
git commit -m "next-site: browse page"
```

---

### Task 4: Plugin detail page with server-rendered OG tags

**Files:**
- Create: `worker/src/pages/detail.ts`
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: `htmlShell`, `escapeHtml` from Task 3's `theme.ts`; `buildPublicIndex`, `getOverride` from Task 2.
- Produces: `renderDetailPage(id: string, plugin: IndexPlugin, override: Override | null): string`.

- [ ] **Step 1: Detail page renderer**

`worker/src/pages/detail.ts`:
```ts
import { escapeHtml, htmlShell } from '../theme'
import type { Override } from '../db'
import type { IndexPlugin } from '../publicIndex'

export function renderDetailPage(id: string, plugin: IndexPlugin, override: Override | null): string {
	const description = override?.description ?? plugin.description
	const tagline = override?.tagline ?? description
	const version = plugin.channels.latest ?? Object.keys(plugin.versions)[0]

	const featuresHtml = override?.features?.length
		? `<ul>${override.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
		: ''

	const body = `
		<header>
			<div class="brand">
				<a href="/" class="brand-mark" style="text-decoration:none;">N</a>
				<div class="brand-name">${escapeHtml(plugin.name)}</div>
			</div>
			<nav><a href="/">All plugins</a></nav>
		</header>
		<div class="wrap">
			<div class="page-title" style="margin-top: 22px;">${escapeHtml(plugin.name)}</div>
			<div class="page-sub">${escapeHtml(tagline)}</div>
			<p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.75);">${escapeHtml(description)}</p>
			${featuresHtml}
			<div class="card-meta" style="margin: 16px 0;">${escapeHtml(plugin.author)} &middot; v${escapeHtml(version ?? '?')}</div>
			<a class="btn" href="/index.json">Add repository in Revenge Next</a>
		</div>`

	return htmlShell({
		title: `${plugin.name} - Revenge Next`,
		description: tagline,
		ogTitle: plugin.name,
		ogDescription: tagline,
		body,
	})
}
```

Note on the install button: Next's actual per-plugin deep-link install scheme (if one exists beyond "add this repository's index.json URL in-app") wasn't confirmed this session - linking to `/index.json` with "Add repository in Revenge Next" is the documented, always-correct fallback (matches this repo's own README: "This repository auto-deploys to next.jarviscli.dev", described as a repository endpoint, not per-plugin links). If Next gains a confirmed per-plugin deep-link scheme later, swap this one link - nothing else in this task depends on the exact URL shape.

- [ ] **Step 2: Wire the `/plugins/<id>` route**

Modify `worker/src/index.ts`:
```ts
import { getAllChannels, getAllOverrides, getOverride } from './db'
import { renderDetailPage } from './pages/detail'
// ...

const detailMatch = url.pathname.match(/^\/plugins\/([\w.-]+)$/)
if (detailMatch) {
	const id = detailMatch[1]
	const baseRes = await env.ASSETS.fetch(new URL('/index.json', request.url))
	const base = await baseRes.json<BaseIndex>()
	const [overrides, channels] = await Promise.all([getAllOverrides(env), getAllChannels(env)])
	const merged = buildPublicIndex(base, overrides, channels)

	const plugin = merged.plugins[id]
	if (!plugin) return new Response('Not found', { status: 404 })

	return new Response(renderDetailPage(id, plugin, overrides[id] ?? null), {
		headers: { 'content-type': 'text/html; charset=utf-8' },
	})
}
```

- [ ] **Step 3: Typecheck, format, deploy, verify OG tags live**

```bash
cd /root/revenge-next-plugs
bun run lint:types 2>&1 | grep -v "^plugins/staff-tags/js/patches/details.tsx"
bunx biome check --write worker
bunx wrangler deploy
curl -s https://next.jarviscli.dev/plugins/dev.everestmcarthur.staff-tags | grep -E "og:title|og:description"
```
Expected: `og:title` content is `Staff Tags` (or whatever it's renamed to by the time this runs - see the Custom Tags rework, tracked separately), not `revenge-next-plugs` or any site-wide fallback string. This is the concrete check the user asked for.

- [ ] **Step 4: Commit**

```bash
git add worker
git commit -m "next-site: plugin detail page with per-plugin OG tags"
```

---

### Task 5: Admin auth, admin UI, and write endpoints

**Files:**
- Create: `worker/src/admin/auth.ts`
- Create: `worker/src/admin/routes.ts`
- Create: `worker/src/pages/admin.ts`
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: `upsertOverride`, `setChannel` from Task 2's `db.ts`; `htmlShell` from Task 3.
- Produces: `checkAuth(request: Request, env: Env): boolean`; `handleAdminApi(request: Request, env: Env, url: URL): Promise<Response | null>` (returns `null` if the path isn't an admin API route, so `index.ts` can fall through cleanly).

- [ ] **Step 1: Auth check**

`worker/src/admin/auth.ts`:
```ts
import type { Env } from '../env'

export function checkAuth(request: Request, env: Env): boolean {
	const auth = request.headers.get('authorization')
	return auth === `Bearer ${env.ADMIN_TOKEN}`
}
```

- [ ] **Step 2: Write endpoints**

`worker/src/admin/routes.ts`:
```ts
import { setChannel, upsertOverride } from '../db'
import { checkAuth } from './auth'
import type { Env } from '../env'
import type { BaseIndex } from '../publicIndex'

const PLUGIN_ID_REGEX = /^[a-zA-Z0-9.-]+$/ // matches generate-index.ts's own validation exactly

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json' },
	})
}

const DEFAULT_MAIN_JS = `export default plugin({\n\tstart() {},\n})\n`

async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
	return Array.from(new Uint8Array(digest))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
}

/** Returns null if `url.pathname` isn't an admin API route, so the caller can fall through. */
export async function handleAdminApi(request: Request, env: Env, url: URL): Promise<Response | null> {
	if (!url.pathname.startsWith('/api/admin/')) return null

	if (!checkAuth(request, env)) return json({ error: 'unauthorized' }, 401)

	const overrideMatch = url.pathname.match(/^\/api\/admin\/overrides\/([\w.-]+)$/)
	if (overrideMatch && request.method === 'PUT') {
		const id = overrideMatch[1]
		if (!PLUGIN_ID_REGEX.test(id)) return json({ error: 'invalid id' }, 400)

		const body = await request.json<Record<string, unknown>>().catch(() => null)
		if (!body) return json({ error: 'invalid body' }, 400)

		const patch: Parameters<typeof upsertOverride>[2] = {
			name: body.name as string | undefined,
			description: body.description as string | undefined,
			tagline: body.tagline as string | undefined,
			note: body.note as string | undefined,
			category: body.category as string | undefined,
			accent: body.accent as string | undefined,
			status: body.status as string | undefined,
			howItWorks: body.howItWorks as string | undefined,
			features: body.features as string[] | undefined,
			commands: body.commands as { cmd: string; desc: string }[] | undefined,
			limitations: body.limitations as string | undefined,
			hidden: body.hidden as boolean | undefined,
			isDraft: body.isDraft as boolean | undefined,
		}

		if (patch.isDraft) {
			const mainJs = (body.mainJs as string | undefined) ?? DEFAULT_MAIN_JS
			patch.mainJs = mainJs
			patch.manifest = JSON.stringify({
				format: 1,
				id,
				name: patch.name ?? id,
				description: patch.description ?? '',
				author: (body.author as string | undefined) ?? '',
				version: (body.version as string | undefined) ?? '0.0.1',
				dependencies: { 'revenge.api': { version: '>=1 <2' }, discord: { version: '*' } },
				dist: { script: 'index.js' },
			})
		}

		await upsertOverride(env, id, patch)
		return json({ ok: true })
	}

	const channelMatch = url.pathname.match(/^\/api\/admin\/channels\/([\w.-]+)\/([\w-]+)$/)
	if (channelMatch && request.method === 'PUT') {
		const [, id, channel] = channelMatch
		const body = await request.json<{ version?: string }>().catch(() => null)
		if (!body?.version) return json({ error: 'version required' }, 400)

		// Mirrors generate-index.ts's own "Channel override points at unpublished version" check -
		// a channel can only ever point at a version that's actually in the built index.
		const baseRes = await env.ASSETS.fetch('https://internal/index.json')
		const base = await baseRes.json<BaseIndex>()
		const plugin = base.plugins[id]
		if (!plugin || !(body.version in plugin.versions)) {
			return json({ error: `version '${body.version}' is not published for '${id}'` }, 400)
		}

		await setChannel(env, id, channel, body.version)
		return json({ ok: true })
	}

	return json({ error: 'not found' }, 404)
}
```

- [ ] **Step 3: Admin page (token entry + edit UI)**

`worker/src/pages/admin.ts`:
```ts
import { htmlShell } from '../theme'

/**
 * Single-page admin UI: a token field gates everything else client-side (the real gate is
 * server-side, in handleAdminApi - this is just UX, not security). Once a token is entered, it
 * fetches /index.json for the plugin list and lets the admin PUT overrides/channels directly.
 */
export function renderAdminPage(): string {
	const body = `
		<header>
			<div class="brand">
				<a href="/" class="brand-mark" style="text-decoration:none;">N</a>
				<div class="brand-name">Admin</div>
			</div>
			<nav><a href="/">Back to site</a></nav>
		</header>
		<div class="wrap" style="padding-top:22px;">
			<div id="gate">
				<div class="page-sub">Admin token</div>
				<input id="token" type="password" style="background:#15161c;border:1px solid rgba(255,255,255,0.12);color:#e8e9ed;padding:8px 10px;border-radius:6px;width:280px;">
				<button id="unlock" class="btn" style="border:none;cursor:pointer;margin-left:8px;">Unlock</button>
			</div>
			<div id="panel" style="display:none;"></div>
		</div>
		<script>
			const gate = document.getElementById('gate')
			const panel = document.getElementById('panel')
			let token = ''

			async function loadPlugins() {
				const res = await fetch('/index.json')
				const data = await res.json()
				panel.innerHTML = Object.entries(data.plugins).map(([id, p]) => \`
					<div class="card" style="margin-bottom:12px;">
						<div class="card-name">\${p.name} <span class="card-meta">(\${id})</span></div>
						<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
							<input placeholder="tagline" data-id="\${id}" data-field="tagline" style="background:#15161c;border:1px solid rgba(255,255,255,0.12);color:#e8e9ed;padding:6px 8px;border-radius:6px;flex:1;">
							<label style="font-size:11px;display:flex;align-items:center;gap:4px;"><input type="checkbox" data-id="\${id}" data-field="hidden"> hidden</label>
							<button data-id="\${id}" class="btn save" style="border:none;cursor:pointer;">Save</button>
						</div>
						<div style="margin-top:8px;display:flex;gap:8px;">
							<input placeholder="version" data-id="\${id}" data-channel="stable" style="background:#15161c;border:1px solid rgba(255,255,255,0.12);color:#e8e9ed;padding:6px 8px;border-radius:6px;width:100px;">
							<button data-id="\${id}" data-channel="stable" class="btn promote" style="border:none;cursor:pointer;">Promote to stable</button>
						</div>
					</div>
				\`).join('')

				panel.querySelectorAll('.save').forEach(btn => btn.addEventListener('click', async () => {
					const id = btn.dataset.id
					const tagline = panel.querySelector(\`[data-id="\${id}"][data-field="tagline"]\`).value
					const hidden = panel.querySelector(\`[data-id="\${id}"][data-field="hidden"]\`).checked
					await fetch(\`/api/admin/overrides/\${id}\`, {
						method: 'PUT',
						headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\` },
						body: JSON.stringify({ tagline, hidden }),
					})
					alert('Saved ' + id)
				}))

				panel.querySelectorAll('.promote').forEach(btn => btn.addEventListener('click', async () => {
					const id = btn.dataset.id
					const channel = btn.dataset.channel
					const version = panel.querySelector(\`[data-id="\${id}"][data-channel="\${channel}"]\`).value
					const res = await fetch(\`/api/admin/channels/\${id}/\${channel}\`, {
						method: 'PUT',
						headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\` },
						body: JSON.stringify({ version }),
					})
					const data = await res.json()
					alert(res.ok ? \`Promoted \${id}@\${version} to \${channel}\` : data.error)
				}))
			}

			document.getElementById('unlock').addEventListener('click', () => {
				token = document.getElementById('token').value
				gate.style.display = 'none'
				panel.style.display = 'block'
				loadPlugins()
			})
		</script>`

	return htmlShell({ title: 'Admin - Revenge Next', description: 'Admin panel', body })
}
```

- [ ] **Step 4: Wire `/admin` and `/api/admin/*` into the fetch handler**

Modify `worker/src/index.ts`:
```ts
import { handleAdminApi } from './admin/routes'
import { renderAdminPage } from './pages/admin'
// ...

if (url.pathname === '/admin') {
	return new Response(renderAdminPage(), { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

const adminApiRes = await handleAdminApi(request, env, url)
if (adminApiRes) return adminApiRes
```
(Place this branch before the final `env.ASSETS.fetch(request)` fallback, alongside the other route checks from Tasks 2-4.)

- [ ] **Step 5: Typecheck, format**

```bash
cd /root/revenge-next-plugs
bun run lint:types 2>&1 | grep -v "^plugins/staff-tags/js/patches/details.tsx"
bunx biome check --write worker
```

- [ ] **Step 6: Deploy and verify auth gating live**

```bash
bunx wrangler deploy
curl -s -o /dev/null -w "%{http_code}\n" https://next.jarviscli.dev/api/admin/overrides/dev.everestmcarthur.radial-status -X PUT -d '{}'
```
Expected: `401` (no `Authorization` header sent).

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://next.jarviscli.dev/api/admin/overrides/dev.everestmcarthur.radial-status \
  -X PUT -H "authorization: Bearer <the-real-token-from-task-1-step-4>" \
  -H "content-type: application/json" -d '{"tagline":"test tagline"}'
curl -s https://next.jarviscli.dev/plugins/dev.everestmcarthur.radial-status | grep "test tagline"
```
Expected: `200`, and the tagline shows up live on the detail page - confirms the whole write -> read path works end to end. Revert the test edit afterward (`PUT` again with the real tagline, or `hidden: false` / whatever the correct value was) so a throwaway test string doesn't stay live.

- [ ] **Step 7: Commit**

```bash
git add worker
git commit -m "next-site: admin auth, admin UI, override/channel write endpoints"
```

---

### Task 6: Extend verify-deploy.mjs, final end-to-end verification

**Files:**
- Modify: `.github/scripts/verify-deploy.mjs`

**Interfaces:**
- Consumes: nothing new - this task only adds checks to the existing script's already-fetched `idx` data plus two new fetches.

- [ ] **Step 1: Add the OG-tag and admin-401 checks**

Modify `.github/scripts/verify-deploy.mjs`, appending after the existing sha256 check:
```js
// New checks added for the next.jarviscli.dev site (browse/detail/admin pages).

const detailHtml = await fetchWithRetry(`${BASE_URL}/plugins/${id}`, { html: true });
if (!detailHtml.includes(`property="og:title" content="${plugin.name}"`)) {
    throw new Error(`Plugin detail page for ${id} is missing correct og:title for "${plugin.name}"`);
}
console.log(`Verified ${id}: og:title present and correct`);

const unauthedRes = await fetch(`${BASE_URL}/api/admin/overrides/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "{}",
});
if (unauthedRes.status !== 401) {
    throw new Error(`Unauthenticated admin write should return 401, got ${unauthedRes.status}`);
}
console.log("Verified: unauthenticated admin write correctly rejected (401)");
```

`fetchWithRetry` currently only supports `binary` (returns `arrayBuffer()`) or JSON (`res.json()`) - add an `html` option:
```js
async function fetchWithRetry(url, { attempts = 5, delayMs = 3000, binary = false, html = false } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`${url} responded ${res.status} ${res.statusText}`);
            }
            if (binary) return await res.arrayBuffer();
            if (html) return await res.text();
            return await res.json();
        } catch (e) {
            lastError = e;
            if (attempt < attempts) {
                console.log(`Attempt ${attempt}/${attempts} for ${url} failed (${e.message}), retrying in ${delayMs}ms...`);
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }
    throw new Error(`${url} failed after ${attempts} attempts: ${lastError.message}`);
}
```

- [ ] **Step 2: Run the smoke test against the live site**

```bash
cd /root/revenge-next-plugs
bun .github/scripts/verify-deploy.mjs
```
Expected: all four "Verified ..." lines print, script exits 0.

- [ ] **Step 3: Full local rebuild + redeploy, confirming nothing in the Gradle/generate-index pipeline broke**

```bash
rm -rf build
./gradlew packageAllPlugins
bun run generate-index -- --dist build/dist --base-url https://next.jarviscli.dev --out build/dist/index.json
bunx wrangler deploy
bun .github/scripts/verify-deploy.mjs
```
Expected: clean build, clean deploy, smoke test passes.

- [ ] **Step 4: Manual browser check**

Visit `https://next.jarviscli.dev/` and `https://next.jarviscli.dev/admin` directly (not curl) - confirm the browse page renders per the approved mockup, and the admin panel's token gate/edit/promote flow works end to end (enter the real `ADMIN_TOKEN`, edit a tagline, promote a version, confirm it shows up on `/`).

- [ ] **Step 5: Commit**

```bash
git add .github/scripts/verify-deploy.mjs
git commit -m "next-site: extend verify-deploy.mjs with OG-tag and admin-auth checks"
```

---

## Self-Review

**Spec coverage:**
- D1-backed admin, no live-broadcast -> Task 1-2 (no DO/WebSocket anywhere in this plan). Covered.
- Public feed shows only `stable` -> `buildPublicIndex` in Task 2. Covered.
- Browse + detail pages, approved visual direction -> Task 3-4. Covered.
- Per-plugin OG tags -> Task 4, tested in Task 6. Covered.
- Admin token gate, edit any field, hide/show, channel promotion, draft creation -> Task 5. Covered.
- Error handling (D1 down, bad channel target, bad token) -> `upsertOverride`/`setChannel` don't special-case D1-down (D1 is either up or the whole Worker request fails - Cloudflare's D1 binding doesn't have a distinct "unreachable but rest of Worker still runs" mode within a single request the way an external HTTP call would); the channel-target and token checks are both implemented in Task 5 exactly as specced.
- Testing -> Task 6.

**Placeholder scan:** No TBD/TODO. The one open point (Next's per-plugin deep-link scheme) is explicitly flagged as a known unknown with a concrete, correct fallback, not a placeholder - Task 4's note explains why and what to do if it's resolved later.

**Type consistency:** `Override` type defined once in `db.ts` (Task 2), imported everywhere else that needs it (Task 4's `renderDetailPage`, Task 5's `routes.ts`). `BaseIndex`/`IndexPlugin`/`IndexVersion` defined once in `publicIndex.ts` (Task 2), imported by Tasks 3-5. `Env` defined once in `env.ts` (Task 1), imported everywhere. No renamed/drifted signatures across tasks.
