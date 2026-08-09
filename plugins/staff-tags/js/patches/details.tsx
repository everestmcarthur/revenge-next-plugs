import { Stores } from '@revenge-mod/discord/flux'
import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { after } from '@revenge-mod/patcher'
import { findInReactFiber } from '@revenge-mod/utils/react'
import { fiberFilter } from '../lib/fiber'
import { withMemoDefaultName } from '../lib/filters'
import getTag from '../lib/getTag'
import { guard } from '../lib/safe'
import GradientTag from '../ui/GradientTag'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { FC } from 'react'
import type { StaffTagsStorage } from '../lib/types'

interface UserRowProps {
	guildId?: string
	user: any
}

interface TagComponentProps {
	type: number
	text: string
	textColor: string
	backgroundColor: string
	verified: boolean
}

/**
 * Covers member list rows and the profile popout, where the name and tag sit on the same line.
 *
 * Multiple distinct `UserRow` implementations can exist in the same build (member list vs.
 * profile popout, etc.), so this subscribes rather than doing a single lookup - `max` is a guess
 * and may need adjusting once verified live, see eval-for-revenge.
 *
 * `UserRow` is real but `React.memo()`-wrapped (confirmed live via a memo-patching sweep) - a
 * plain `withName('UserRow')` can never match it, since the wrapper object has no `.name` of its
 * own (only the memo-hidden inner function does). `withMemoDefaultName` (`../lib/filters`) checks
 * the wrapper's inner `.type.name` instead and matches on the full module namespace, so the
 * callback below receives `{default: <memo wrapper>}`.
 *
 * Patches the memo wrapper's inner `.type` directly with a single persistent `after()` (same
 * pattern `chat.ts` uses on `getTagProperties`), reading `props` fresh from `args[0]` on every
 * call - NOT the old per-`createElement` `afterJSX`+`afterRendered`, self-unpatching approach.
 * That approach is unsound for memo components specifically: every row instance shares the exact
 * same inner render function (memo only produces one), so patching it per-instance still patches
 * one shared target, and every currently-stacked self-unpatching hook fires on *any* row's actual
 * render call, not just the row that registered it - each hook then unpatches itself regardless
 * of whether the `ret` it received actually belonged to its own row. In practice this meant tags
 * almost never landed on the correct row (mismatched pairing, silently swallowed by `guard()`),
 * and the never-correctly-consumed hooks piled up unbounded across scrolling/re-mounts until the
 * sheer patch-chain depth broke rendering outright (confirmed live - the member list going empty
 * after normal use, see /root/evals-for-rn). A single persistent patch on the shared function,
 * reading each call's own `args[0]`, doesn't have this pairing problem: `args[0]` is always
 * correctly paired to whichever row is actually being rendered on that call, same guarantee
 * `chat.ts` already relies on for its shared `getTagProperties` patch.
 *
 * Uses `getModules` (reacts once Discord itself initializes each module) instead of
 * `lookupModule` (which force-initializes uninitialized modules right away) - forcing UserRow /
 * the Tag module to init during `start()`, before Discord is done booting, is what crashed app
 * startup the first time this shipped.
 *
 * Every callback below is wrapped in `guard()`: it runs whenever Discord itself renders/
 * initializes the matched module, not inside `applyPatches`' try/catch, which only covers the
 * synchronous setup calls - an uncaught throw here crashes app startup instead of just skipping
 * one row, and (per the above) would otherwise poison the shared render function for every row.
 *
 * TODO(live-verify): rendered-tree shape (`c?.type?.Types`) still unconfirmed, see eval-for-revenge.
 */
export default function patchDetails(storage: JsonStorage<StaffTagsStorage>) {
	const patches: (() => void)[] = []

	let TagModule: { default?: FC<TagComponentProps> } | undefined
	const unsubTagModule = getModules(
		withProps('default', 'getBotLabel'),
		mod => {
			TagModule = mod as { default?: FC<TagComponentProps> }
		},
		{ skipDefault: true },
	)
	patches.push(unsubTagModule)

	const GuildStore = Stores.GuildStore as unknown as {
		getGuild(id: string | undefined): any
	}

	const unsubUserRow = getModules(
		withMemoDefaultName('UserRow'),
		mod => {
			guard(() => {
				const wrapper = (mod as { default: { type: FC<UserRowProps> } }).default
				if (typeof wrapper.type !== 'function') return

				patches.push(
					after(wrapper, 'type', (args, ret) =>
						guard(() => {
							const props = args?.[0] as UserRowProps | undefined
							if (!props?.user) return ret

							const { guildId, user } = props

							const label = findInReactFiber(
								ret as any,
								fiberFilter(
									c =>
										Array.isArray(c?.props?.children) &&
										c.props.children.some(
											(ch: any) =>
												typeof ch === 'string' ||
												typeof ch?.props?.children === 'string',
										),
								),
							)
							if (!label) return ret

							const existingTag = findInReactFiber(
								label as any,
								fiberFilter(c => c?.type?.Types),
							)
							if (existingTag && existingTag.props?.type !== 0) return ret

							const guild = GuildStore?.getGuild(guildId)
							const tag = getTag(storage, guild, undefined, user)
							if (!tag) return ret

							if (existingTag) {
								Object.assign(existingTag.props, {
									type: 0,
									text: tag.text,
									textColor: tag.textColor,
									backgroundColor: tag.backgroundColor,
									verified: tag.verified,
								})
								return ret
							}

							const container = label as any
							if (!Array.isArray(container.props.children)) {
								container.props.children = [container.props.children]
							}

							if (tag.gradientColor) {
								container.props.children.push(
									<GradientTag
										text={tag.text}
										textColor={tag.textColor}
										backgroundColor={tag.backgroundColor}
										gradientColor={tag.gradientColor}
									/>,
								)
							} else if (TagModule?.default) {
								const Component = TagModule.default
								container.props.children.push(
									<Component
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
					),
				)
			}, undefined)
		},
		{ max: 4 },
	)
	patches.push(unsubUserRow)

	return () => patches.forEach(unpatch => unpatch())
}
