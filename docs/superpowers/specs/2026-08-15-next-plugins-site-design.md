# next.jarviscli.dev Design

## Goal

Build a public, browsable, installable plugin site for revenge-next-plugs at
`next.jarviscli.dev`, plus a token-gated admin panel for editing plugin
metadata and managing release channels. Currently that domain serves only a
bare `/index.json` install feed (Next's client-side install protocol) with no
HTML site at all.

Explicitly framed by the user as "a better advancement of classic's website"
(the equivalent site already built this session for the Vendetta-compat
`revenge-plugins` repo, at `rp.jarviscli.dev`) - reusing classic's proven
patterns where they fit, deliberately diverging where classic falls short.

## Audience

Both: end users browsing/installing plugins, and the repo owner using it as
an admin/management dashboard. Not a documentation site for other Next
plugin developers - out of scope for this design.

## Architecture

A single Cloudflare Worker (extending the existing `revenge-next-plugs`
Worker, which currently only has a static `[assets]` binding) serves:

- `/` - public plugin browse page
- `/plugins/<id>` - plugin detail page, with per-plugin Open Graph metadata
- `/index.json` - the real install feed Next's client reads (format
  unchanged from today, so nothing on the client side needs to change)
- `/admin` - token-gated admin UI
- `/api/admin/*` - admin write endpoints (protected server-side)

Two D1 tables hold live-editable state, read on every request and merged
with the base data already produced by the existing build pipeline
(`./gradlew packageAllPlugins` -> `build/dist/<id>.zip` + a base
`index.json`, generated exactly as today):

```sql
CREATE TABLE plugin_overrides (
    id TEXT PRIMARY KEY,              -- e.g. "dev.everestmcarthur.custom-tags"
    name TEXT, description TEXT, tagline TEXT, note TEXT,
    category TEXT, accent TEXT, status TEXT,
    how_it_works TEXT, features TEXT, commands TEXT, limitations TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    is_draft INTEGER NOT NULL DEFAULT 0,
    manifest TEXT,                     -- only used when is_draft = 1
    main_js TEXT,                      -- only used when is_draft = 1
    updated_at TEXT NOT NULL
);

CREATE TABLE plugin_channels (
    plugin_id TEXT NOT NULL,
    channel TEXT NOT NULL,             -- 'alpha' | 'beta' | 'stable'
    version TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (plugin_id, channel)
);
```

`is_draft = 1` plugins mirror classic's overlay system: a plugin that exists
entirely through the admin panel (manifest + JS stored directly in D1), never
touching git, for quick one-off testing.

No Durable Object / WebSocket live-broadcast (classic has one, for
multi-tab-sees-edits-instantly). Deliberately dropped: with one admin and two
plugins today, that's real infrastructure for a scenario that isn't
happening. A page refresh after saving covers it. Can be added later if that
stops being true.

## Channels

Every plugin version can be promoted to `alpha`, `beta`, or `stable` via the
admin panel. This is purely an admin-side staging mechanism for this site -
**the public site and the public `/index.json` only ever expose the version
currently on `stable`**, surfaced as `"latest"` in the install feed (matching
Next's current client-side protocol exactly, so installing a plugin from the
site behaves identically to today). Alpha/beta versions are visible only in
the admin panel. This is intentionally decoupled from whatever channel
system Next's core client eventually builds - the site's job is only to
control what gets exposed as `"latest"` for public install.

## Pages

**`/` (browse):** cards per visible (`hidden = 0`) plugin - icon, name,
tagline, channel badge, author, version, install button. Filter chips by
category. Visual direction: dark background, functional (not decorative) use
of a single purple accent - reserved for badges/interactive elements only,
never used as a glowing background gradient. Real header with nav. See the
approved mockup at `.superpowers/brainstorm/263484-1786809105/content/glass-refined.html`.

**`/plugins/<id>` (detail):** full description, how-it-works, features,
commands, limitations, source/issue links, install button. **Server-rendered
`<meta>` tags** (not client-side JS - link unfurlers don't execute JS):
`og:title` = plugin name, `og:description` = plugin's tagline/short
description, matching `twitter:card` tags. This directly fixes a real gap in
classic's site, where plugin links unfurl showing the site-wide branding
("revenge-plugins" / what Revenge is) instead of the linked plugin's own
info - classic's plugin pages never got their own `<meta>` tags. Not
proposing a fix to classic here (out of scope), just not repeating the
mistake.

**`/admin`:** gated by a single secret token (`ADMIN_TOKEN` Worker secret,
same mechanism as classic - compared server-side, entered once in the
browser and kept client-side for subsequent requests). Once authenticated:
edit any `plugin_overrides` field per plugin, toggle `hidden`, set
`alpha`/`beta`/`stable` -> version per plugin, create an `is_draft` plugin.

## Error handling

- D1 unreachable: Worker serves the base static (build-time) data with no
  overrides applied, rather than failing the request. The site stays up;
  admin edits just don't show until D1 recovers.
- Promoting a version to a channel that doesn't exist in the built index is
  rejected with a clear error (mirrors the existing check in
  `generate-index.ts` for `repo.config.json` channel overrides: "Channel
  override .../... points at unpublished version").
- Missing or incorrect admin token: clean 401 on every `/api/admin/*`
  endpoint, no partial access.

## Testing

Extends the existing `.github/scripts/verify-deploy.mjs` post-deploy smoke
test:

- `/index.json` parses and every advertised `sha256` matches the real zip
  bytes (existing check, unchanged).
- A plugin detail page's `og:title`/`og:description` actually reflect that
  plugin's own name/description, not a site-wide fallback.
- An unauthenticated request to an admin write endpoint returns 401 (catches
  the gate silently ending up open after a deploy).

## Out of scope

- Documentation/reference site for other Next plugin developers.
- Exposing channel selection to end users (Next core may build this
  separately; this site's public feed only ever shows `stable`).
- Live multi-tab broadcast of admin edits (Durable Object/WebSocket).
- Any changes to classic's (`revenge-plugins`) site.
