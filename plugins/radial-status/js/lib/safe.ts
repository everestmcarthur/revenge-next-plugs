/**
 * Runs `fn` and swallows any throw, returning `fallback` instead.
 *
 * `getModules`'s callback runs whenever Discord itself initializes a matching module, which can
 * be deep inside Discord's own boot sequence - completely outside any try/catch wrapped around
 * the initial registration call. An uncaught throw there crashes app startup instead of just
 * skipping the ring patch.
 */
export function guard<T>(fn: () => T, fallback: T): T {
	try {
		return fn()
	} catch {
		return fallback
	}
}
