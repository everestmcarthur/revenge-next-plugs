import { after } from '@revenge-mod/patcher'
import type { FC, ReactElement, ReactNode } from 'react'

/**
 * Hooks the render output of a *specific element instance* by patching its own `type` property.
 *
 * This is safe (unlike patching a component's module export) because `element.type` is a fresh
 * reference on an object we just created ourselves - nothing else has captured it yet, so there's
 * no same-chunk-destructuring staleness to worry about. See @revenge-mod/patcher's `after` docs
 * and the pattern used by Revenge's own `user-badges` plugin (`afterRendered` there).
 */
export const afterRendered = (
	element: ReactElement<any, FC<any>>,
	hook: (el: ReactNode) => ReactNode,
) =>
	after(element, 'type', el =>
		el instanceof Promise ? el.then(hook) : hook(el),
	)
