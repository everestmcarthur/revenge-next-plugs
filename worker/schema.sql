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
    features TEXT,
    commands TEXT,
    limitations TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    is_draft INTEGER NOT NULL DEFAULT 0,
    manifest TEXT,
    main_js TEXT,
    updated_at TEXT NOT NULL
);

DROP TABLE IF EXISTS plugin_channels;
CREATE TABLE plugin_channels (
    plugin_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    version TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (plugin_id, channel)
);

CREATE TABLE IF NOT EXISTS site_settings (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    updated_at TEXT NOT NULL
);
