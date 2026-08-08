/**
 * Runs `fn` and swallows any throw, returning `fallback` instead.
 *
 * `applyPatches`/`safePatch` only guard the synchronous call that *registers* a patch (e.g.
 * `getModules(filter, cb)` itself). The `cb` runs later - whenever Discord happens to initialize
 * a matching module, which can be deep inside Discord's own boot sequence - completely outside
 * that try/catch. An uncaught throw there crashes app startup instead of just skipping a tag.
 * Every render-triggered callback (getModules/afterJSX/beforeJSX/afterRendered) needs its own
 * guard for this reason.
 */
export function guard<T>(fn: () => T, fallback: T): T {
	try {
		return fn()
	} catch {
		return fallback
	}
}

/**
 * Adds a style object to an existing `style` prop without assuming its shape. RN style props are
 * commonly a single object (not an array) - spreading a non-array/non-iterable value with `[...x]`
 * throws, which is what crashed app boot the first time this shipped.
 */
export function mergeStyle(
	style: unknown,
	patch: Record<string, unknown>,
): unknown[] {
	if (Array.isArray(style)) return [...style, patch]
	if (style) return [style, patch]
	return [patch]
}
