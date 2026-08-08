import { Stores } from '@revenge-mod/discord/flux'
import { getModules } from '@revenge-mod/modules/finders'
import { withProps, withSingleProp } from '@revenge-mod/modules/finders/filters'
import { brighten, isValidHex, rawColors, relativeLuminance } from './color'
import type { DiscordModules } from '@revenge-mod/discord/types'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { StaffTagsStorage, TagOverride } from './types'

interface PermissionsModule {
	computePermissions(args: {
		user: unknown
		context: unknown
		overwrites?: unknown
	}): bigint | number | undefined
	canEveryoneRole?: unknown
}

interface GuildMember {
	colorString?: string
}

type GuildMemberStoreType = DiscordModules.Flux.Store<{
	getMember(
		guildId: string | undefined,
		userId: string | undefined,
	): GuildMember | null
}>

/**
 * Reads `Stores.GuildMemberStore` fresh on each call rather than caching it at module scope.
 *
 * External plugin bundles run via a bare `new Function('revenge', 'plugin', script)` call with
 * no Metro-style dependency ordering, at preInit, regardless of which lifecycle the plugin
 * actually declares - so touching *any* `revenge.*` API at module top level runs before
 * Revenge's own API-providing plugins are guaranteed to have set anything up. This function is
 * only ever called from inside a render patch, well after boot, where that's no longer a risk.
 */
function getGuildMemberStore(): GuildMemberStoreType {
	return Stores.GuildMemberStore as GuildMemberStoreType
}

/**
 * Subscribed once, lazily, from `start()` rather than at plugin-module import time. Uses
 * `getModules` (reacts once Discord itself initializes the module) instead of `lookupModule`
 * (which force-initializes uninitialized modules right away) - `getTag()` only runs from inside
 * a render patch, well after boot, so this is lower-risk than the boot-time lookups elsewhere in
 * this plugin, but there's no reason to force it either. If the module isn't warmed up yet on the
 * very first call, permission-based tags just don't resolve for that call and pick up on the next
 * render once it's available.
 *
 * TODO(live-verify): computePermissions/Permissions module shapes, see eval-for-revenge.
 */
let permissionsModule: PermissionsModule | undefined
let PermissionsMap: { Permissions: Record<string, bigint | number> } | undefined
let permissionsSubscribed = false

function resolvePermissionsModules(): void {
	if (permissionsSubscribed) return
	permissionsSubscribed = true
	getModules(
		withProps<PermissionsModule>('computePermissions', 'canEveryoneRole'),
		mod => {
			permissionsModule = mod
		},
	)
	getModules(
		withSingleProp<{ Permissions: Record<string, bigint | number> }>(
			'Permissions',
		),
		mod => {
			PermissionsMap = mod
		},
	)
}

export interface TagDefinition {
	id: string
	defaultText: string
	defaultColor: string
	condition?: (guild: any, channel: any, user: any) => boolean
	permissions?: string[]
}

export const TAG_DEFINITIONS: TagDefinition[] = [
	{
		id: 'webhook',
		defaultText: 'WEBHOOK',
		defaultColor: '#99AAB5',
		condition: (_g, _c, user) => !!user?.isNonUserBot?.(),
	},
	{
		id: 'owner',
		defaultText: 'OWNER',
		defaultColor: '#F0B232',
		condition: (guild, _c, user) => !!guild && guild.ownerId === user?.id,
	},
	{
		id: 'admin',
		defaultText: 'ADMIN',
		defaultColor: '#F23F42',
		permissions: ['ADMINISTRATOR'],
	},
	{
		id: 'staff',
		defaultText: 'STAFF',
		defaultColor: '#23A55A',
		permissions: [
			'MANAGE_GUILD',
			'MANAGE_CHANNELS',
			'MANAGE_ROLES',
			'MANAGE_WEBHOOKS',
		],
	},
	{
		id: 'mod',
		defaultText: 'MOD',
		defaultColor: '#5865F2',
		permissions: ['MANAGE_MESSAGES', 'KICK_MEMBERS', 'BAN_MEMBERS'],
	},
	{
		id: 'vc_mod',
		defaultText: 'VC Mod',
		defaultColor: '#1ABC9C',
		permissions: ['MOVE_MEMBERS', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS'],
	},
	{
		id: 'chat_mod',
		defaultText: 'Chat Mod',
		defaultColor: '#9B59B6',
		permissions: ['MODERATE_MEMBERS'],
	},
]

export interface ResolvedTag {
	id: string
	text: string
	textColor: string
	backgroundColor: string
	gradientColor?: string
	verified: boolean
}

/** Reads the per-tag settings override from the (already-loaded) storage cache. Never mutates it - use `storage.set()` for writes. */
export function tagSettings(
	storage: JsonStorage<StaffTagsStorage>,
	id: string,
): TagOverride {
	return storage.cache?.tags?.[id] ?? {}
}

function resolveBackgroundColor(
	def: TagDefinition,
	settings: TagOverride,
	storage: JsonStorage<StaffTagsStorage>,
	guild: any,
	user: any,
): string {
	if (settings.useCustomColor && isValidHex(settings.color)) {
		return settings.color
	}

	if (storage.cache?.useRoleColor) {
		try {
			const roleColor = getGuildMemberStore()?.getMember?.(
				guild?.id,
				user?.id,
			)?.colorString
			if (roleColor) return roleColor
		} catch {
			// fall through to default
		}
	}

	return def.defaultColor
}

export default function getTag(
	storage: JsonStorage<StaffTagsStorage>,
	guild: any,
	channel: any,
	user: any,
): ResolvedTag | undefined {
	if (!user) return undefined

	resolvePermissionsModules()

	let permissions: string[] = []
	if (guild) {
		try {
			const permissionsInt = permissionsModule?.computePermissions?.({
				user,
				context: guild,
				overwrites: channel?.permissionOverwrites,
			})

			if (permissionsInt != null && PermissionsMap?.Permissions) {
				permissions = Object.entries(PermissionsMap.Permissions)
					.filter(([, bit]) => (permissionsInt as bigint) & (bit as bigint))
					.map(([name]) => name)
			}
		} catch {
			// no guild permission context available, treat as none
		}
	}

	for (const def of TAG_DEFINITIONS) {
		const settings = tagSettings(storage, def.id)
		if (settings.enabled === false) continue

		const matchesCondition = !!def.condition?.(guild, channel, user)
		const matchesPermission =
			!user.bot && !!def.permissions?.some(p => permissions.includes(p))
		if (!matchesCondition && !matchesPermission) continue

		const backgroundColor = resolveBackgroundColor(
			def,
			settings,
			storage,
			guild,
			user,
		)
		const textColor =
			relativeLuminance(backgroundColor) > 0.35
				? rawColors.BLACK_500
				: rawColors.WHITE_500

		let gradientColor: string | undefined
		if (settings.useGradient) {
			gradientColor = isValidHex(settings.gradientColor)
				? settings.gradientColor
				: brighten(backgroundColor, 0.4)
		}

		return {
			id: def.id,
			text: settings.text?.trim() || def.defaultText,
			textColor,
			backgroundColor,
			gradientColor,
			verified: false,
		}
	}

	return undefined
}
