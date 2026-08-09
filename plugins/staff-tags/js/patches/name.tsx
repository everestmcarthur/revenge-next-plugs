import { Stores } from '@revenge-mod/discord/flux'
import { getModules } from '@revenge-mod/modules/finders'
import { withName, withProps } from '@revenge-mod/modules/finders/filters'
import { afterJSX } from '@revenge-mod/react/jsx-runtime'
import { findInReactFiber } from '@revenge-mod/utils/react'
import { afterRendered } from '../lib/afterRendered'
import { fiberFilter } from '../lib/fiber'
import getTag from '../lib/getTag'
import { guard } from '../lib/safe'
import GradientTag from '../ui/GradientTag'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { FC } from 'react'
import type { StaffTagsStorage } from '../lib/types'

interface DisplayNameProps {
	guildId?: string
	channelId?: string
	user: any
}

interface HeaderNameProps {
	channelId?: string
}

interface TagComponentProps {
	type: number
	text: string
	textColor: string
	backgroundColor: string
	verified: boolean
	style?: any
}

/**
 * Covers the name row shown in chat messages (next to the display name + timestamp) and channel
 * headers.
 *
 * `HeaderName` doesn't exist under that name in the current build (confirmed live - Discord
 * renamed/refactored it at some point). `ChannelHeader` is the confirmed replacement: found via a
 * broad name-sweep as a plain, non-memo-wrapped function, high confidence given its name and
 * shape - a plain `withName` lookup can find it directly, unlike `UserRow` in `details.tsx` which
 * needed a memo-aware filter.
 *
 * `DisplayName` (the message-author-name row) is still unresolved - not found under any name even
 * via a memo/forwardRef sweep and a text-content correlation sweep across two separate live
 * sessions. Most likely inlined into a bigger message-row component now rather than factored out
 * the way Classic had it. Left as a best-effort lookup below (guarded, silently no-ops) rather
 * than guessed at - fixing this needs a fresh live investigation, not a guess.
 *
 * Uses `getModules` (reacts once Discord itself initializes each module) instead of
 * `lookupModule` (which force-initializes uninitialized modules right away) - forcing
 * DisplayName/ChannelHeader/the Tag module to init during `start()`, before Discord is done
 * booting, is what crashed app startup the first time this shipped.
 *
 * Every callback below is wrapped in `guard()`: it runs whenever Discord itself renders/
 * initializes the matched module, not inside `applyPatches`' try/catch, which only covers the
 * synchronous setup calls - an uncaught throw here crashes app startup instead of just skipping
 * a name row.
 *
 * TODO(live-verify): ChannelHeader's rendered-tree shape (`c?.type?.Types`, the
 * flexDirection: "row" container) still unconfirmed, see eval-for-revenge. DisplayName remains
 * fully unresolved.
 */
export default function patchName(storage: JsonStorage<StaffTagsStorage>) {
	const cleanups: (() => void)[] = []

	let TagModule: { default?: FC<TagComponentProps> } | undefined
	const unsubTagModule = getModules(
		withProps('default', 'getBotLabel'),
		mod => {
			TagModule = mod as { default?: FC<TagComponentProps> }
		},
		{ skipDefault: true },
	)
	cleanups.push(unsubTagModule)

	const GuildStore = Stores.GuildStore as unknown as {
		getGuild(id: string | undefined): any
	}
	const ChannelStore = Stores.ChannelStore as unknown as {
		getChannel(id: string | undefined): any
	}

	const unsubHeaderName = getModules(
		withName<FC<HeaderNameProps>>('ChannelHeader'),
		ChannelHeader => {
			guard(() => {
				cleanups.push(
					afterJSX(ChannelHeader, el =>
						guard(() => {
							const { channelId } = el.props
							const unpatch = afterRendered(el, ret =>
								guard(() => {
									unpatch()
									const node = ret as any
									if (node?.props) node.props.channelId = channelId
									return ret
								}, ret),
							)
							return el
						}, el),
					),
				)
			}, undefined)
		},
	)
	cleanups.push(unsubHeaderName)

	const unsubDisplayName = getModules(
		withName<FC<DisplayNameProps>>('DisplayName'),
		DisplayName => {
			guard(() => {
				cleanups.push(
					afterJSX(DisplayName, el =>
						guard(() => {
							const { guildId, channelId, user } = el.props
							const unpatch = afterRendered(el, ret =>
								guard(() => {
									unpatch()

									const tagComponent = findInReactFiber(
										ret as any,
										fiberFilter(c => c?.type?.Types),
									)

									// A real built-in tag (bot/system/etc.) is already present - don't touch it.
									if (tagComponent && tagComponent.props?.type !== 0) return ret

									const guild = GuildStore?.getGuild(guildId)
									const channel = ChannelStore?.getChannel(channelId)
									const tag = getTag(storage, guild, channel, user)
									if (!tag) return ret

									if (tagComponent) {
										tagComponent.props = {
											type: 0,
											text: tag.text,
											textColor: tag.textColor,
											backgroundColor: tag.backgroundColor,
											verified: tag.verified,
										}
										return ret
									}

									const row = findInReactFiber(
										ret as any,
										fiberFilter(c => c?.props?.style?.flexDirection === 'row'),
									)
									if (!Array.isArray(row?.props?.children)) return ret

									if (tag.gradientColor) {
										row.props.children.push(
											<GradientTag
												style={{ marginLeft: 0 }}
												text={tag.text}
												textColor={tag.textColor}
												backgroundColor={tag.backgroundColor}
												gradientColor={tag.gradientColor}
											/>,
										)
									} else if (TagModule?.default) {
										const Component = TagModule.default
										row.props.children.push(
											<Component
												style={{ marginLeft: 0 }}
												type={0}
												text={tag.text}
												textColor={tag.textColor}
												backgroundColor={tag.backgroundColor}
												verified={tag.verified}
											/>,
										)
									}

									return ret
								}, ret),
							)
							return el
						}, el),
					),
				)
			}, undefined)
		},
	)
	cleanups.push(unsubDisplayName)

	return () => cleanups.forEach(fn => fn())
}
