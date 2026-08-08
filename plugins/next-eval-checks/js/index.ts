import { getModules } from '@revenge-mod/modules/finders'
import {
	createFilterGenerator,
	FilterFlag,
	FilterScopes,
	withName,
	withProps,
	withSingleProp,
} from '@revenge-mod/modules/finders/filters'
import { after, before, instead as insteadPatch } from '@revenge-mod/patcher'
import { React, ReactNative } from '@revenge-mod/react'
import { afterJSX } from '@revenge-mod/react/jsx-runtime'
import { findInReactFiber } from '@revenge-mod/utils/react'

/**
 * One-shot diagnostic plugin for staff-tags' six live-verify assumptions. Logs results via
 * Discord's own Logger (Settings > Debug Logs) as each check resolves - some resolve almost
 * immediately (module lookups), some only once you navigate to the relevant screen
 * (DisplayName/HeaderName needs a channel open, UserRow needs the member list open,
 * getTagProperties needs a message with a bot/staff tag visible).
 *
 * All of the imports above are static and generate no code by themselves - the compiled bundle
 * only touches `revenge.*` where these are actually *called*, and every call below happens
 * inside `start()` or a callback it registers, never at module top level. Every reactive
 * callback is also wrapped in `guard()`. Both are lessons from the staff-tags boot-crash history
 * (project memory: revenge-next-plugin-patch-safety) - a diagnostic plugin is not exempt from
 * either just because it's throwaway.
 */

function guard<T>(fn: () => T, fallback: T): T {
	try {
		return fn()
	} catch {
		return fallback
	}
}

function safeStringify(value: unknown): string {
	return JSON.stringify(value, (_key, v) =>
		typeof v === 'bigint' ? `${v}n` : v,
	)
}

export default plugin({
	start(api) {
		const log = (label: string, data: unknown) => {
			api.logger.log(`[EvalChecks] ${label}: ${safeStringify(data)}`)
		}

		function withTimeout(label: string, ms: number, found: { value: boolean }) {
			setTimeout(() => {
				if (!found.value)
					log(label, { found: false, note: `not found within ${ms}ms` })
			}, ms)
		}

		// 1. Permissions module
		guard(() => {
			const permFound = { value: false }
			const permsMapFound = { value: false }

			getModules(
				withProps<{ computePermissions: unknown; canEveryoneRole: unknown }>(
					'computePermissions',
					'canEveryoneRole',
				),
				mod => {
					guard(() => {
						permFound.value = true
						log('permissionsModule', {
							found: true,
							keys: Object.keys(mod),
							computePermissionsType: typeof mod.computePermissions,
						})
					}, undefined)
				},
			)
			withTimeout('permissionsModule', 5000, permFound)

			getModules(
				withSingleProp<{ Permissions: Record<string, unknown> }>('Permissions'),
				mod => {
					guard(() => {
						permsMapFound.value = true
						log('permissionsMap', {
							found: true,
							sampleKeys: Object.keys(mod.Permissions).slice(0, 10),
							adminBitType: typeof mod.Permissions.ADMINISTRATOR,
						})
					}, undefined)
				},
			)
			withTimeout('permissionsMap', 5000, permsMapFound)
		}, undefined)

		// 2. Tag module (default + getBotLabel)
		guard(() => {
			const found = { value: false }
			getModules(
				withProps<{ default: unknown; getBotLabel: unknown }>(
					'default',
					'getBotLabel',
				),
				mod => {
					guard(() => {
						found.value = true
						log('tagModule', {
							found: true,
							keys: Object.keys(mod),
							defaultType: typeof mod.default,
							defaultName: (mod.default as any)?.name,
							getBotLabelType: typeof mod.getBotLabel,
						})
					}, undefined)
				},
				{ skipDefault: true },
			)
			withTimeout('tagModule', 5000, found)
		}, undefined)

		// 3. Gradient component
		guard(() => {
			const startEndFound = { value: false }
			const locationsFound = { value: false }

			getModules(
				withProps<Record<string, unknown>>('colors', 'start', 'end'),
				mod => {
					guard(() => {
						startEndFound.value = true
						log('gradientComponent.startEnd', {
							found: true,
							type: typeof mod,
							name: (mod as any)?.name,
						})
					}, undefined)
				},
			)
			withTimeout('gradientComponent.startEnd', 5000, startEndFound)

			getModules(
				withProps<Record<string, unknown>>('colors', 'locations'),
				mod => {
					guard(() => {
						locationsFound.value = true
						log('gradientComponent.locations', {
							found: true,
							type: typeof mod,
							name: (mod as any)?.name,
						})
					}, undefined)
				},
			)
			withTimeout('gradientComponent.locations', 5000, locationsFound)
		}, undefined)

		// 4. DisplayName / HeaderName - needs a channel with messages open
		guard(() => {
			const moduleFound = { value: false }
			const renderSeen = { value: false }

			getModules(withName<any>('DisplayName'), DisplayName => {
				guard(() => {
					moduleFound.value = true
					log('displayName.module', {
						found: true,
						fnName: (DisplayName as any)?.name,
					})

					let unpatchJSX = () => {}
					unpatchJSX = afterJSX(DisplayName, el =>
						guard(() => {
							const unpatchType = after(el as any, 'type', ret =>
								guard(() => {
									unpatchType()
									unpatchJSX()
									renderSeen.value = true
									const row = findInReactFiber(
										ret as any,
										((c: any) =>
											c?.props?.style?.flexDirection === 'row') as any,
									)
									log('displayName.render', {
										found: true,
										rowContainerSeen: !!row,
									})
									return ret
								}, ret),
							)
							return el
						}, el),
					)
				}, undefined)
			})
			withTimeout('displayName.module', 8000, moduleFound)
			withTimeout('displayName.render', 15000, renderSeen)

			const headerFound = { value: false }
			getModules(withName<any>('HeaderName'), HeaderName => {
				guard(() => {
					headerFound.value = true
					log('headerName', { found: true, fnName: (HeaderName as any)?.name })
				}, undefined)
			})
			withTimeout('headerName', 8000, headerFound)
		}, undefined)

		// 5. UserRow - needs the member list open
		guard(() => {
			let count = 0
			const unsub = getModules(
				withName<any>('UserRow'),
				(UserRow, id) => {
					guard(() => {
						count++
						log('userRow', {
							found: true,
							index: count,
							id,
							fnName: (UserRow as any)?.name,
						})
					}, undefined)
				},
				{ max: 10 },
			)
			setTimeout(() => {
				unsub()
				if (count === 0)
					log('userRow', { found: false, note: 'not found within 15000ms' })
			}, 15000)
		}, undefined)

		// 6. getTagProperties - needs a message with a bot/staff tag visible
		guard(() => {
			const found = { value: false }
			getModules(
				withName<any>('getTagProperties'),
				mod => {
					guard(() => {
						const namespace = mod as { default?: (args: any) => any }
						if (!namespace.default) return

						const unpatch = insteadPatch(
							namespace as { default: (args: any) => any },
							'default',
							([args], original) => {
								const ret = original(args)
								return guard(() => {
									if (!found.value) {
										found.value = true
										unpatch()
										log('getTagProperties', {
											found: true,
											argKeys: Object.keys(args ?? {}),
											messageKeys: args?.message
												? Object.keys(args.message)
												: null,
										})
									}
									return ret
								}, ret)
							},
						)
					}, undefined)
				},
				{ returnNamespace: true },
			)
			withTimeout('getTagProperties', 15000, found)
		}, undefined)

		// 7. Name sweep - DisplayName/HeaderName/UserRow are confirmed gone under those exact
		// names (Discord renamed/refactored them at some point), so instead of guessing single
		// replacement names one at a time, this sweeps every currently-initialized module for an
		// exported function whose .name matches a broad pattern, logging every match found. Real
		// candidates for the message-row name, channel header, and member-list row should show up
		// here - keep the member list and a channel with messages open for this one.
		guard(() => {
			const pattern = /Name|Row|Header|Author|Member|Username|Tag$/i

			const withNameMatching = createFilterGenerator<[]>(
				(_args, _id, exports) => {
					const name = (exports as any)?.name
					return typeof name === 'string' && pattern.test(name)
				},
				() => 'evalChecks.nameSweep',
				FilterFlag.RequiresExports,
				FilterScopes.Initialized,
			)

			let count = 0
			getModules(
				withNameMatching(),
				(mod, id) => {
					guard(() => {
						count++
						log('nameSweep', {
							index: count,
							id,
							name: (mod as any)?.name,
							type: typeof mod,
						})
					}, undefined)
				},
				{ max: 80 },
			)
			setTimeout(() => {
				log('nameSweep.summary', { totalMatches: count })
			}, 20000)
		}, undefined)

		// 8. React.memo/forwardRef sweep - name-based search (checks 4/5/7) can never find a
		// React.memo()-wrapped or forwardRef()-wrapped component, because the wrapper object has
		// no .name of its own. This patches React.memo/forwardRef themselves so the inner named
		// function's real name is captured at the moment it's wrapped, before that name is lost.
		// Only catches memo()/forwardRef() calls that happen AFTER this patch is installed - if
		// the target component's module already ran before this plugin's start(), it's missed.
		// For a real answer, force-quit and reopen the app with this plugin already enabled,
		// rather than just backgrounding/foregrounding it.
		guard(() => {
			const pattern =
				/Name|Row|Header|Author|Member|Username|Tag|Display|Nameplate/i
			const seen = new Set<string>()

			const report = (kind: string, name: string | undefined) => {
				if (name && pattern.test(name) && !seen.has(name)) {
					seen.add(name)
					log('memoSweep', { kind, name })
				}
			}

			if (typeof React?.memo === 'function') {
				before(React as any, 'memo', args => {
					guard(() => {
						report('memo', (args?.[0] as any)?.name)
					}, undefined)
					return args
				})
			} else {
				log('memoSweep.setup', { error: 'React.memo not available yet' })
			}

			if (typeof React?.forwardRef === 'function') {
				before(React as any, 'forwardRef', args => {
					guard(() => {
						report('forwardRef', (args?.[0] as any)?.name)
					}, undefined)
					return args
				})
			} else {
				log('memoSweep.setup', { error: 'React.forwardRef not available yet' })
			}

			setTimeout(() => {
				log('memoSweep.summary', { totalMatches: seen.size })
			}, 20000)
		}, undefined)

		// 9. Message-author-name discovery via Text-content correlation. Neither name search nor
		// the memo/forwardRef sweep found anything for the chat message's author name row, which
		// suggests it isn't a separately-named component at all anymore (likely inlined into a
		// bigger message-row component). Instead of searching by name, this grabs a real author
		// name off a live message (piggybacking on the already-confirmed getTagProperties hook),
		// then watches every <Text> element created for one whose content matches that name. When
		// found, it captures a JS stack trace at that exact moment - since createElement calls run
		// synchronously inside the calling component's own function body, the stack should reveal
		// the enclosing component's name even though it isn't independently searchable.
		guard(() => {
			// Keeps updating to the MOST RECENT message's author rather than locking onto the
			// first one seen - a cached/already-rendered message's author is useless as a search
			// target (its Text was created before this patch installed, same issue as the memo
			// sweep), so the target has to track whatever message is *about to* freshly render.
			let authorName: string | undefined
			let matchCount = 0

			getModules(
				withName<(args: any) => any>('getTagProperties'),
				mod => {
					guard(() => {
						const namespace = mod as { default?: (args: any) => any }
						if (!namespace.default) return

						insteadPatch(namespace as { default: (args: any) => any }, 'default', ([args], original) => {
							const ret = original(args)
							guard(() => {
								const author = args?.message?.author
								const name = author?.globalName || author?.username || author?.nick
								if (typeof name === 'string' && name.length > 0 && name !== authorName) {
									authorName = name
									log('textSweep.authorTarget', { authorName })
								}
							}, undefined)
							return ret
						})
					}, undefined)
				},
				{ returnNamespace: true }
			)

			if (!ReactNative?.Text) {
				log('textSweep.setup', { error: 'ReactNative.Text not available yet' })
			} else {
				afterJSX(ReactNative.Text, el =>
					guard(() => {
						if (!authorName || matchCount >= 3) return el

						const children = (el.props as any)?.children
						const isMatch = children === authorName || (typeof children === 'string' && children.includes(authorName)) || (Array.isArray(children) && children.some((c: any) => c === authorName))

						if (isMatch) {
							matchCount++
							const stack = new Error().stack ?? ''
							log('textSweep.match', {
								authorName,
								matchCount,
								stackLines: stack.split('\n').slice(0, 12)
							})
						}

						return el
					}, el)
				)
			}

			setTimeout(() => {
				log('textSweep.summary', { matchCount, lastAuthorName: authorName })
			}, 45000)
		}, undefined)
	},
})
