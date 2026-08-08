import { Stores } from '@revenge-mod/discord/flux'
import { getModules } from '@revenge-mod/modules/finders'
import { withName } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'
import { processColor } from 'react-native'
import getTag from '../lib/getTag'
import { guard } from '../lib/safe'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { StaffTagsStorage } from '../lib/types'

interface GetTagPropertiesArgs {
	message: { author?: any }
	channel?: { guild_id?: string }
}

interface TagProperties {
	tagType?: unknown
	tagText?: string
	tagTextColor?: unknown
	tagBackgroundColor?: unknown
	tagVerified?: boolean
}

/**
 * Chat message tags are rendered from plain data (not a patchable element tree), so gradients
 * aren't possible here - only in the member list and profile, where we control the JSX directly.
 *
 * `getTagProperties` is a plain data function, not a rendered component, so `afterJSX` doesn't
 * apply - this stays a module-property patch via `patcher.instead`, same mechanism the Classic
 * build used successfully for this exact function.
 *
 * Uses `getModules` (reacts once Discord itself initializes the module) instead of
 * `lookupModule` (which force-initializes uninitialized modules right away) - forcing this
 * module to init during `start()`, before Discord is done booting, is what crashed app startup
 * the first time this shipped.
 *
 * `{ returnNamespace: true }` asks for the whole module object (not just the unwrapped default
 * export) so `instead` has a `parent`/`key` pair to patch in place.
 *
 * The `instead` hook is guarded: unlike the JSX patches, it *replaces* the original function for
 * every future call, so an uncaught throw here wouldn't just skip one tag - it would break
 * message rendering entirely from that point on.
 *
 * Confirmed live (see /root/evals-for-rn): args are `{message, isSystemDM, channel, colors}` -
 * `channel` is handed to us directly, so no `ChannelStore.getChannel()` lookup is needed.
 */
export default function patchChat(storage: JsonStorage<StaffTagsStorage>) {
	let unpatch = () => {}

	const GuildStore = Stores.GuildStore as unknown as {
		getGuild(id: string | undefined): any
	}

	const unsub = getModules(
		withName<(args: GetTagPropertiesArgs) => TagProperties>('getTagProperties'),
		TagPropertiesModule => {
			guard(() => {
				const mod = TagPropertiesModule as unknown as {
					default?: (args: GetTagPropertiesArgs) => TagProperties
				}
				if (!mod.default) return

				unpatch = instead(
					mod as { default: (args: GetTagPropertiesArgs) => TagProperties },
					'default',
					([args], original) => {
						// Call through unguarded - if Discord's own function throws, that's not
						// something we caused or can meaningfully recover from here.
						const ret = original(args)

						// Only our own augmentation is guarded: fall back to the real, unmodified
						// result rather than risk breaking every message render from here on.
						return guard(() => {
							if (ret?.tagType) return ret

							const { message, channel } = args
							const guild = GuildStore?.getGuild(channel?.guild_id)
							const tag = getTag(storage, guild, channel, message?.author)
							if (!tag) return ret

							return {
								...ret,
								tagText: tag.text,
								tagTextColor: tag.textColor
									? processColor(tag.textColor)
									: undefined,
								tagBackgroundColor: processColor(tag.backgroundColor),
								tagVerified: tag.verified,
								tagType: undefined,
							}
						}, ret)
					},
				)
			}, undefined)
		},
		{ returnNamespace: true },
	)

	return () => {
		unsub()
		unpatch()
	}
}
