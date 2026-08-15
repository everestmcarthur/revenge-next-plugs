import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { beforeJSX } from '@revenge-mod/react/jsx-runtime'
import { guard } from '../lib/safe'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { ElementType } from 'react'
import type { RadialStatusStorage } from '../lib/types'

// Forked from AngelW0lf's Radial Status (BSD-3-Clause, see LICENSE), ported from the Classic
// (Vendetta-compat) version of this plugin. Real presence-carrying wrappers are square,
// borderRadius === width/2, with a user.id + status on children[1]/[3], and exactly 5 children -
// matched against this confirmed set of sizes rather than any circular shape. This heuristic is
// Discord-UI-generic (not Classic/Next specific) and is carried over unchanged.
const CONFIRMED_SIZES = new Set([24, 32, 40, 50, 60, 80])

function tryApplyRing(
	props: unknown,
	storage: JsonStorage<RadialStatusStorage>,
) {
	if (!storage.cache?.enabled) return
	if (!props || !Array.isArray((props as any).style)) return

	const wrapper = props as { style: any[]; children?: any[] }
	if (!Array.isArray(wrapper.children) || wrapper.children.length !== 5) return

	const circleIdx = wrapper.style.findIndex(
		s =>
			s &&
			typeof s.width === 'number' &&
			s.width === s.height &&
			s.borderRadius === s.width / 2 &&
			CONFIRMED_SIZES.has(s.width),
	)
	if (circleIdx === -1) return

	const userProps = wrapper.children?.[1]?.props
	const presenceProps = wrapper.children?.[3]?.props
	if (!userProps || typeof userProps.user?.id !== 'string') return
	if (!presenceProps || typeof presenceProps.status !== 'string') return

	const colors = storage.cache?.colors ?? {}
	const color = colors[presenceProps.status as string]
	if (!color) return // no color configured for this status - leave the native dot alone

	const baseSize = wrapper.style[circleIdx].width
	// Additive growth (fixed px), not a percentage multiplier - a flat multiplier made the ring
	// way too thick on large avatars (YouBar) relative to small ones (member list).
	const thickness = storage.cache?.ringThickness ?? 2
	const newSize = baseSize + thickness * 2

	presenceProps.size = 0
	presenceProps.isMobileOnline = false
	if (presenceProps.style) presenceProps.style.display = 'none'
	if (userProps.cutout?.nativeCutouts?.[0])
		userProps.cutout.nativeCutouts[0].size = 0

	wrapper.style[circleIdx] = {
		width: newSize,
		height: newSize,
		borderRadius: newSize / 2,
		overflow: 'hidden',
	}
	wrapper.style.push({
		borderWidth: thickness,
		borderColor: color,
		borderStyle: 'solid',
	})
}

/**
 * `General.View` in Classic (Vendetta-compat) resolves to `findByProps("Button", "Text", "View")`
 * (confirmed against vendetta-mod/Vendetta's own source, since `@revenge-mod/discord/design`'s
 * `Design` object does NOT expose raw View/Text/Button - it's the higher-level design-system kit,
 * a different module). `getModules` (not `lookupModule`) is used deliberately - matches this
 * repo's own house convention (see staff-tags/js/patches/name.tsx): forcing this to initialize
 * during `start()`, before Discord is done booting, is what crashed app startup for staff-tags
 * the first time it shipped.
 */
export default function patchRing(storage: JsonStorage<RadialStatusStorage>) {
	const cleanups: (() => void)[] = []

	const unsubGeneral = getModules(
		withProps('Button', 'Text', 'View'),
		mod => {
			guard(() => {
				const View = (mod as { View?: ElementType }).View
				if (!View) return

				cleanups.push(
					beforeJSX(View, args => {
						guard(() => tryApplyRing(args[1], storage), undefined)
						return args
					}),
				)
			}, undefined)
		},
		{ skipDefault: true },
	)
	cleanups.push(unsubGeneral)

	return () => cleanups.forEach(fn => fn())
}
