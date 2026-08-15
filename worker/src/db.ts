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

export async function getOverride(
	env: Env,
	id: string,
): Promise<Override | null> {
	const row = await env.DB.prepare(
		'SELECT * FROM plugin_overrides WHERE id = ?1',
	)
		.bind(id)
		.first<Row>()
	return row ? rowToOverride(row) : null
}

export async function getAllOverrides(
	env: Env,
): Promise<Record<string, Override>> {
	const { results } = await env.DB.prepare(
		'SELECT * FROM plugin_overrides',
	).all<Row>()
	const out: Record<string, Override> = {}
	for (const row of results) out[row.id] = rowToOverride(row)
	return out
}

export async function getChannels(
	env: Env,
	id: string,
): Promise<Record<string, string>> {
	const { results } = await env.DB.prepare(
		'SELECT channel, version FROM plugin_channels WHERE plugin_id = ?1',
	)
		.bind(id)
		.all<{ channel: string; version: string }>()
	const out: Record<string, string> = {}
	for (const row of results) out[row.channel] = row.version
	return out
}

export async function getAllChannels(
	env: Env,
): Promise<Record<string, Record<string, string>>> {
	const { results } = await env.DB.prepare(
		'SELECT plugin_id, channel, version FROM plugin_channels',
	).all<{
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

export async function upsertOverride(
	env: Env,
	id: string,
	patch: Partial<Override>,
): Promise<void> {
	const existing = await getOverride(env, id)
	const merged: Override = {
		hidden: false,
		isDraft: false,
		...existing,
		...patch,
	}

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

export interface SiteSettings {
	name?: string
	description?: string
}

export async function getSiteSettings(env: Env): Promise<SiteSettings | null> {
	const row = await env.DB.prepare(
		'SELECT name, description FROM site_settings WHERE id = ?1',
	)
		.bind('site')
		.first<{ name: string | null; description: string | null }>()
	if (!row) return null
	return {
		name: row.name ?? undefined,
		description: row.description ?? undefined,
	}
}

export async function setSiteSettings(
	env: Env,
	patch: Partial<SiteSettings>,
): Promise<void> {
	const existing = await getSiteSettings(env)
	const merged: SiteSettings = { ...existing, ...patch }

	await env.DB.prepare(
		`INSERT INTO site_settings (id, name, description, updated_at) VALUES ('site', ?1, ?2, ?3)
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, updated_at = excluded.updated_at`,
	)
		.bind(
			merged.name ?? null,
			merged.description ?? null,
			new Date().toISOString(),
		)
		.run()
}

export async function setChannel(
	env: Env,
	id: string,
	channel: string,
	version: string,
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO plugin_channels (plugin_id, channel, version, updated_at) VALUES (?1,?2,?3,?4)
		 ON CONFLICT(plugin_id, channel) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at`,
	)
		.bind(id, channel, version, new Date().toISOString())
		.run()
}
