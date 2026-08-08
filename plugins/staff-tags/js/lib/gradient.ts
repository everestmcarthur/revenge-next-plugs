import { lookupModule } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import type { FC, ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

interface GradientProps {
	colors: string[]
	start?: { x: number; y: number }
	end?: { x: number; y: number }
	style?: StyleProp<ViewStyle>
	children?: ReactNode
}

let cached: FC<GradientProps> | null | undefined
let attempted = false

/**
 * Discord ships a native gradient view (used for boost/nitro badges) but it isn't part of any
 * stable public API, so this is a best-effort lookup that quietly returns null if it can't be
 * found - gradient tags then fall back to a solid color instead of crashing anything.
 *
 * `withProps` checks the default export automatically and unwraps to it, mirroring the old
 * `findByProps(...).default` lookup from the Classic build.
 *
 * Deliberately still uses `lookupModule` (which force-initializes uninitialized modules) rather
 * than `getModules` here, unlike the other lookups in this plugin: this only ever runs from
 * inside `GradientTag`'s render, which only happens post-boot when a gradient tag is actually
 * about to be drawn on screen, and the call site needs a component reference synchronously to
 * decide what JSX to return - `getModules`' callback-based "maybe later" shape doesn't fit here.
 *
 * TODO(live-verify): unconfirmed against the current Next/Discord build, see eval-for-revenge.
 */
export function getGradientComponent(): FC<GradientProps> | null {
	if (attempted) return cached ?? null
	attempted = true

	try {
		const [startEndMatch] = lookupModule(
			withProps<Record<string, unknown>>('colors', 'start', 'end'),
		)
		const [locationsMatch] = lookupModule(
			withProps<Record<string, unknown>>('colors', 'locations'),
		)
		cached =
			(startEndMatch as FC<GradientProps> | undefined) ??
			(locationsMatch as FC<GradientProps> | undefined) ??
			null
	} catch {
		cached = null
	}

	return cached
}
