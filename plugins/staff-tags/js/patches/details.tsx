import { Stores } from '@revenge-mod/discord/flux'
import { getModules } from '@revenge-mod/modules/finders'
import { withName, withProps } from '@revenge-mod/modules/finders/filters'
import { afterJSX } from '@revenge-mod/react/jsx-runtime'
import { findInReactFiber } from '@revenge-mod/utils/react'
import { afterRendered } from '../lib/afterRendered'
import { fiberFilter } from '../lib/fiber'
import getTag from '../lib/getTag'
import { guard } from '../lib/safe'
import GradientTag from '../ui/GradientTag'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { FC } from 'react'
import type { StaffTagsStorage } from '../lib/types'

interface UserRowProps {
	guildId?: string
	user: any
}

interface TagComponentProps {
	type: number
	text: string
	textColor: string
	backgroundColor: string
	verified: boolean
}

/**
 * Covers member list rows and the profile popout, where the name and tag sit on the same line.
 *
 * Multiple distinct `UserRow` implementations can exist in the same build (member list vs.
 * profile popout, etc.), so this subscribes rather than doing a single lookup - `max` is a guess
 * and may need adjusting once verified live, see eval-for-revenge.
 *
 * Uses `getModules` (reacts once Discord itself initializes each module) instead of
 * `lookupModule` (which force-initializes uninitialized modules right away) - forcing UserRow /
 * the Tag module to init during `start()`, before Discord is done booting, is what crashed app
 * startup the first time this shipped.
 *
 * Every callback below is wrapped in `guard()`: it runs whenever Discord itself renders/
 * initializes the matched module, not inside `applyPatches`' try/catch, which only covers the
 * synchronous setup calls - an uncaught throw here crashes app startup instead of just skipping
 * one row.
 *
 * TODO(live-verify): UserRow component name/count, rendered-tree shape (`c?.type?.Types`), see
 * eval-for-revenge.
 */
export default function patchDetails(storage: JsonStorage<StaffTagsStorage>) {
	const patches: (() => void)[] = []

	let TagModule: { default?: FC<TagComponentProps> } | undefined
	const unsubTagModule = getModules(
		withProps('default', 'getBotLabel'),
		mod => {
			TagModule = mod as { default?: FC<TagComponentProps> }
		},
		{ skipDefault: true },
	)
	patches.push(unsubTagModule)

	const GuildStore = Stores.GuildStore as unknown as {
		getGuild(id: string | undefined): any
	}

	const unsubUserRow = getModules(
		withName<FC<UserRowProps>>('UserRow'),
		UserRow => {
			guard(() => {
				patches.push(
					afterJSX(UserRow, el =>
						guard(() => {
							const { guildId, user } = el.props
							const unpatch = afterRendered(el, ret =>
								guard(() => {
									unpatch()

									const label = findInReactFiber(
										ret as any,
										fiberFilter(
											c =>
												Array.isArray(c?.props?.children) &&
												c.props.children.some(
													(ch: any) =>
														typeof ch === 'string' ||
														typeof ch?.props?.children === 'string',
												),
										),
									)
									if (!label) return ret

									const existingTag = findInReactFiber(
										label as any,
										fiberFilter(c => c?.type?.Types),
									)
									if (existingTag && existingTag.props?.type !== 0) return ret

									const guild = GuildStore?.getGuild(guildId)
									const tag = getTag(storage, guild, undefined, user)
									if (!tag) return ret

									if (existingTag) {
										Object.assign(existingTag.props, {
											type: 0,
											text: tag.text,
											textColor: tag.textColor,
											backgroundColor: tag.backgroundColor,
											verified: tag.verified,
										})
										return ret
									}

									const container = label as any
									if (!Array.isArray(container.props.children)) {
										container.props.children = [container.props.children]
									}

									if (tag.gradientColor) {
										container.props.children.push(
											<GradientTag
												text={tag.text}
												textColor={tag.textColor}
												backgroundColor={tag.backgroundColor}
												gradientColor={tag.gradientColor}
											/>,
										)
									} else if (TagModule?.default) {
										const Component = TagModule.default
										container.props.children.push(
											<Component
												type={0}
												text={tag.text}
												textColor={tag.textColor}
												backgroundColor={tag.backgroundColor}
												verified={tag.verified}
											/>,
										)
									}

									return ret
								}, ret),
							)
							return el
						}, el),
					),
				)
			}, undefined)
		},
		{ max: 4 },
	)
	patches.push(unsubUserRow)

	return () => patches.forEach(unpatch => unpatch())
}
