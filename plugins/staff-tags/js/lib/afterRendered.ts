import { after } from '@revenge-mod/patcher'
import type { FC, ReactElement, ReactNode } from 'react'

/**
 * Hooks the render output of a *specific element instance* by patching its own `type` property.
 *
 * This is safe (unlike patching a component's module export) because `element.type` is a fresh
 * reference on an object we just created ourselves - nothing else has captured it yet, so there's
 * no same-chunk-destructuring staleness to worry about. See @revenge-mod/patcher's `after` docs
 * and the pattern used by Revenge's own `user-badges` plugin (`afterRendered` there).
 *
 * For a `React.memo()`-wrapped type, `element.type` is a non-callable `{$$typeof, type, compare}`
 * object, not a function. Patching `element.type` directly (confirmed live - crashed the member
 * list on `UserRow`) replaces it with a proxy whose own stub target *is* callable, which fools
 * React's reconciler into taking the plain-function-component fast path (it checks
 * `typeof Component === 'function'` before checking `$$typeof`) instead of the memo path - React
 * then calls the proxy directly, whose `apply` trap forwards to `Reflect.apply(realMemoWrapper,
 * ...)` and throws `TypeError: target is not callable`, since the real memo wrapper was never
 * callable. Patching the wrapper's *inner* `.type` instead - the actual render function memo
 * hides - avoids this: it's genuinely callable, it's what React actually invokes for a memo
 * component (`updateSimpleMemoComponent` calls the inner function, not the wrapper), and leaving
 * the wrapper's own shape (`$$typeof`/`compare`) untouched keeps React's own type detection
 * correct.
 */
export const afterRendered = (
	element: ReactElement<any, FC<any>>,
	hook: (el: ReactNode) => ReactNode,
) => {
	const type = element.type as unknown as {
		type?: unknown
		$$typeof?: unknown
	}
	const isMemoWrapped =
		typeof element.type !== 'function' && typeof type?.type === 'function'
	const target = (isMemoWrapped ? type : element) as Record<
		'type',
		FC<any>
	>

	return after(target, 'type', el =>
		el instanceof Promise ? el.then(hook) : hook(el),
	)
}
