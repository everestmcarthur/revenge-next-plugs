import {
	createFilterGenerator,
	FilterFlag,
	FilterScopes,
} from '@revenge-mod/modules/finders/filters'

/**
 * `withName` checks `exports.name`/`exports.default.name` - a plain function/class's own
 * runtime name. A `React.memo()`-wrapped component is a `{$$typeof, type, compare}` object with
 * no `.name` of its own (the real name lives on the hidden inner `.type`), so `withName` can
 * structurally never match one - confirmed live for `UserRow` via a memo-patching sweep
 * (`next-eval-checks`' `memoSweep`), and confirmed from `withName`'s own source
 * (`@revenge-mod/modules/finders/filters`): it only ever checks `exports.name` and
 * `exports.default.name`, never `exports.default.type.name`.
 *
 * This filter checks the memo wrapper's inner name instead, and matches on the full module
 * namespace (so the callback receives `{default: <memo wrapper>, ...}`, not the unwrapped
 * default) - the wrapper is what `afterJSX` needs, since that's the exact reference Discord's own
 * `createElement(UserRow, ...)` calls use as `type`, not the inner render function memo hides.
 */
export const withMemoDefaultName = createFilterGenerator<[name: string]>(
	([name], _id, exports) =>
		(exports as { default?: { type?: { name?: string } } })?.default?.type
			?.name === name,
	([name]) => `revenge-next-plugs.staff-tags.memoDefaultName(${name})`,
	FilterFlag.RequiresExports,
	FilterScopes.Initialized,
)
