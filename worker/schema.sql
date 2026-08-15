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

-- Single-row table (id always 'site') for site-wide admin-editable metadata: name/description
-- shown in the browse page hero and used as the default OG tags, overriding repo.config.json's
-- static values without needing a redeploy.
CREATE TABLE IF NOT EXISTS site_settings (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    updated_at TEXT NOT NULL
);
