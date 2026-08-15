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

export function buildPublicIndex(
	base: BaseIndex,
	overrides: Record<string, Override>,
	channels: Record<string, Record<string, string>>,
): BaseIndex {
	const plugins: Record<string, IndexPlugin> = {}
	for (const [id, plugin] of Object.entries(base.plugins)) {
		const override = overrides[id]
		if (override?.hidden) continue

		const pluginChannels = channels[id] ?? {}
		const validChannels = Object.fromEntries(
			Object.entries(pluginChannels).filter(
				([, version]) => version in plugin.versions,
			),
		)

		plugins[id] = {
			...plugin,
			name: override?.name ?? plugin.name,
			description: override?.description ?? plugin.description,
			channels: { ...plugin.channels, ...validChannels },
		}
	}
	return { ...base, plugins }
}
