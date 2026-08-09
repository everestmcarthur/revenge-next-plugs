import { Stores } from '@revenge-mod/discord/flux'
import { getModules } from '@revenge-mod/modules/finders'
import { afterJSX } from '@revenge-mod/react/jsx-runtime'
import { findInReactFiber } from '@revenge-mod/utils/react'
import { fiberFilter } from '../lib/fiber'
import { withMemoDefaultName } from '../lib/filters'
import getTag from '../lib/getTag'
import { guard } from '../lib/safe'
import GradientTag from '../ui/GradientTag'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { FC, ReactElement } from 'react'
import type { StaffTagsStorage } from '../lib/types'

interface UserRowProps {
	guildId?: string
	user: any
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
 * callback below receives `{default: <memo wrapper>}` - `mod.default` is the exact reference
 * Discord's own `createElement(UserRow, ...)` calls use, which is what `afterJSX` needs.
 *
 * Does NOT patch the memo wrapper's shared inner `.type` via `@revenge-mod/patcher`'s generic
 * `after()` (tried and confirmed live to be unsound - see git history on this file). That's true
 * even for a single, non-stacking, persistent `after()` call: wrapping the shared render function
 * in `after()`'s Proxy broke member list rendering outright, every time, even on a fully fresh app
 * process with nothing else patched. Whatever `after()` does to make a target "patchable" doesn't
 * survive contact with this particular shared function.
 *
 * Instead, `afterJSX(wrapper, el => ...)` intercepts each `createElement(UserRow, props)` call
 * (the per-instance element, never the shared object) and does a **plain, unwrapped property
 * assignment** - `el.type = patchedRender` - to a single stable function reused for every row
 * (defined once, outside the `afterJSX` callback, not a fresh closure per row). `patchedRender`
 * manually calls the real inner render function itself (`innerRender(props)`, safe to call
 * directly - React only ever needs the dispatcher active, and it is, since `patchedRender` itself
 * is invoked *by* React as `el`'s render function), then augments the returned tree. This avoids
 * `after()`'s Proxy machinery entirely while still landing a plain, always-callable function
 * (never the non-callable memo wrapper) on `element.type`, so it doesn't hit the earlier
 * "TypeError: target is not callable" crash either. Reusing the same function reference across
 * every row (rather than a fresh closure per element) keeps `element.type` identity stable across
 * re-renders, letting React reconcile these rows normally instead of remounting each one.
 *
 * `UserRow` renders a single `TableRow` whose name+tag live at `ret.props.label` (a `View`) as a
 * **prop**, not somewhere reachable by a generic "find array children containing a string"
 * search - that mismatch (not the render-output shape itself) is why tags never appeared even
 * before the crash: `findInReactFiber` was searching for a shape that doesn't exist in this tree.
 * `label.props.children` is `[nameElement, fragment, existingTagElement]` - confirmed live via
 * `/root/evals-for-rn` - where `existingTagElement` is Discord's own `BotTag` component with a
 * static `.Types` enum and a numeric `type` prop; ordinary members render it already, with
 * `type: 0` (an inactive placeholder, not the "BOT" badge that enum value name suggests). Kept
 * `existingTag.props?.type !== 0` as a guard against stacking our own tag next to a real built-in
 * badge (bot/official/system), but dropped the old "mutate `existingTag`'s props in place" path
 * entirely - confirmed live that `BotTag` derives its displayed label purely from the `type`
 * enum (via the same module's `getBotLabel`), ignoring any custom `text`/color props entirely, so
 * that branch silently did nothing. Always injecting our own plugin-authored `GradientTag`
 * instead (confirmed live to actually render custom text/color) is the only path that works;
 * `GradientTag` already branches on its own `gradientColor` prop for solid-vs-gradient, so there's
 * no need for the old `TagModule` (Discord's `BotTag` module again, same dead end) fallback.
 *
 * Uses `getModules` (reacts once Discord itself initializes the module) instead of
 * `lookupModule` (which force-initializes uninitialized modules right away) - forcing UserRow to
 * init during `start()`, before Discord is done booting, is what crashed app startup the first
 * time this shipped.
 *
 * Every callback below is wrapped in `guard()`: it runs whenever Discord itself renders/
 * initializes the matched module, not inside `applyPatches`' try/catch, which only covers the
 * synchronous setup calls - an uncaught throw here would otherwise skip a row's tag at best, or
 * (per the shared-target lesson above) risk destabilizing every row's rendering at worst.
 */
export default function patchDetails(storage: JsonStorage<StaffTagsStorage>) {
	const patches: (() => void)[] = []

	const GuildStore = Stores.GuildStore as unknown as {
		getGuild(id: string | undefined): any
	}

	const unsubUserRow = getModules(
		withMemoDefaultName('UserRow'),
		mod => {
			guard(() => {
				const wrapper = (mod as { default: { type: FC<UserRowProps> } }).default
				const innerRender = wrapper.type
				if (typeof innerRender !== 'function') return

				// Call through unguarded - if Discord's own render function throws, that's not
				// something we caused or can meaningfully recover from here (same rationale as
				// `chat.ts`'s `getTagProperties` patch). Only our own augmentation is guarded.
				const patchedRender: FC<UserRowProps> = props => {
					const ret = innerRender(props)

					return guard(() => {
						const { guildId, user } = props
						if (!user) return ret

						const label = (ret as ReactElement)?.props?.label as
							| ReactElement
							| undefined
						if (!label || !Array.isArray(label.props?.children)) return ret

						const existingTag = findInReactFiber(
							label as any,
							fiberFilter(c => c?.type?.Types),
						)
						if (existingTag && existingTag.props?.type !== 0) return ret

						const guild = GuildStore?.getGuild(guildId)
						const tag = getTag(storage, guild, undefined, user)
						if (!tag) return ret

						const container = label.props as { children: unknown[] }
						container.children.push(
							<GradientTag
								text={tag.text}
								textColor={tag.textColor}
								backgroundColor={tag.backgroundColor}
								gradientColor={tag.gradientColor}
							/>,
						)

						return ret
					}, ret)
				}

				patches.push(
					afterJSX(wrapper as unknown as FC<UserRowProps>, el =>
						guard(() => {
							;(el as { type: unknown }).type = patchedRender
							return el
						}, el),
					),
				)
			}, undefined)
		},
		{ max: 4 },
	)
	patches.push(unsubUserRow)

	return () => patches.forEach(unpatch => unpatch())
}
