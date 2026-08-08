/**
 * `findInReactFiber` only narrows its result when given a type-predicate function
 * (`(node) => node is X`). These walks are over untyped, Discord-internal fiber/element shapes,
 * so there's no real `X` to narrow to - this just satisfies that signature with `any`.
 */
export function fiberFilter(
	predicate: (node: any) => boolean,
): (node: any) => node is any {
	return predicate as (node: any) => node is any
}
