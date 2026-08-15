export function guard<T>(fn: () => T, fallback: T): T {
	try {
		return fn()
	} catch {
		return fallback
	}
}
