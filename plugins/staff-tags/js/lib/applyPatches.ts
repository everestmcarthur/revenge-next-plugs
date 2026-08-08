export interface PluginLogger {
	error(message: string): void
}

/**
 * Wraps a patch-application function so a single broken lookup only disables that one surface
 * instead of crashing the whole plugin's `start()` and taking every other patch down with it.
 */
function safePatch(
	pluginName: string,
	patchName: string,
	apply: () => () => unknown,
	logger: PluginLogger,
): () => unknown {
	try {
		return apply()
	} catch (e) {
		logger.error(
			`[${pluginName}] Failed to apply the "${patchName}" patch, that surface will be skipped: ${e}`,
		)
		return () => {}
	}
}

/** Applies a named set of patches with safePatch and returns one combined unpatch function. */
export function applyPatches(
	pluginName: string,
	logger: PluginLogger,
	patches: Record<string, () => () => unknown>,
): () => void {
	const unpatches = Object.entries(patches).map(([name, apply]) =>
		safePatch(pluginName, name, apply, logger),
	)
	return () => unpatches.forEach(unpatch => unpatch())
}
