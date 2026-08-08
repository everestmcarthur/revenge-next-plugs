import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { afterJSX } from '@revenge-mod/react/jsx-runtime'
import { findInReactFiber } from '@revenge-mod/utils/react'
import { afterRendered } from '../lib/afterRendered'
import { fiberFilter } from '../lib/fiber'
import { guard, mergeStyle } from '../lib/safe'
import type { FC } from 'react'

interface TagProps {
	text?: string
	textColor?: string
	backgroundColor?: string
}

/**
 * Discord's own Tag component ignores custom text/color props unless we reach into its
 * already-rendered output and push them in ourselves - this is what actually makes the
 * text/textColor/backgroundColor props (that `name.tsx`/`details.tsx` inject) visible.
 *
 * `afterJSX` intercepts every `createElement(Tag, ...)` call globally, regardless of who calls
 * it (Discord's own code or ours) and regardless of which chunk captured the reference -
 * patching the component's module export directly wouldn't reliably reach Discord's own
 * same-chunk render calls.
 *
 * Uses `getModules` (reacts once Discord itself initializes the module) instead of
 * `lookupModule` (which force-initializes uninitialized modules right away to check their
 * exports) - forcing this module to init during `start()`, before Discord is done booting, is
 * what crashed app startup the first time this shipped.
 *
 * Every callback below is wrapped in `guard()`: it runs whenever Discord itself renders/
 * initializes the matched module, not inside `applyPatches`' try/catch, which only covers the
 * synchronous setup call above - an uncaught throw here crashes app startup instead of just
 * skipping this one tag.
 *
 * TODO(live-verify): Tag module shape (`default` + `getBotLabel`), see eval-for-revenge.
 */
export default function patchTag() {
	let unpatchTag = () => {}

	const unsub = getModules(
		withProps<{ default: FC<TagProps>; getBotLabel: unknown }>(
			'default',
			'getBotLabel',
		),
		TagModule => {
			guard(() => {
				const Tag = TagModule.default
				if (!Tag) return

				unpatchTag = afterJSX(Tag, el =>
					guard(() => {
						const { text, textColor, backgroundColor } = el.props
						if (!text && !textColor && !backgroundColor) return el

						const unpatch = afterRendered(el, ret =>
							guard(() => {
								unpatch()

								const label = findInReactFiber(
									ret as any,
									fiberFilter(c => typeof c?.props?.children === 'string'),
								)
								if (!label) return ret

								if (text) label.props.children = text
								if (textColor)
									label.props.style = mergeStyle(label.props.style, {
										color: textColor,
									})
								if (backgroundColor && (ret as any)?.props) {
									;(ret as any).props.style = mergeStyle(
										(ret as any).props.style,
										{ backgroundColor },
									)
								}

								return ret
							}, ret),
						)

						return el
					}, el),
				)
			}, undefined)
		},
		{ skipDefault: true },
	)

	return () => {
		unsub()
		unpatchTag()
	}
}
