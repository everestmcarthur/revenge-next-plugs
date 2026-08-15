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
