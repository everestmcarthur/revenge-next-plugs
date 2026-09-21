import { isExcludedDomain, shortenUrl, uploadFile } from './lib/api'
import { DEFAULT_STORAGE, type ZiplineStorage } from './lib/types'
import Settings from './ui/Settings'

const TAG = '[Zipline]'
const URL_REGEX = /https?:\/\/[^\s<>"]+/g
const MESSAGE_ACTION_CREATORS_MODULE_ID = 7696

function extractFileInfo(att: any) {
	const uri =
		att?.uri ||
		att?.item?.uri ||
		att?.file?.uri ||
		att?.url ||
		att?.item?.url ||
		att?.path
	const name =
		att?.filename ||
		att?.name ||
		att?.item?.filename ||
		att?.item?.name ||
		att?.file?.name ||
		'file'
	const type =
		att?.mimeType ||
		att?.type ||
		att?.item?.mimeType ||
		att?.item?.type ||
		att?.file?.type ||
		'application/octet-stream'
	return { uri, name, type }
}

export default plugin<{ jsonStorage: ZiplineStorage }>({
	jsonStorage: {
		load: true,
		default: DEFAULT_STORAGE,
	},

	start(api) {
		const cleanups: Array<() => void> = []

		const showToast = (content: string) => {
			try {
				revenge.discord.actions.ToastActionCreators?.open?.({ content })
			} catch {}
		}

		const setClipboard = (text: string) => {
			try {
				revenge.react.ReactNative?.Clipboard?.setString?.(text)
			} catch {}
		}

		const patchMessageActions = (mod: any) => {
			const target = mod?.default ?? mod
			if (!target || typeof target.sendMessage !== 'function') return

			try {
				const unpatch = revenge.patcher.instead(
					target,
					'sendMessage',
					async (args: any[], orig: any) => {
						const storage = api.jsonStorage.cache || DEFAULT_STORAGE
						const token = storage.token?.trim()

						// If not configured, pass straight through
						if (!token) {
							return orig.apply(target, args)
						}

						const [channelId, message, promise, options] = args
						let content: string = message?.content ?? ''

						const rawAttachments: any[] =
							options?.attachmentsToUpload ?? options?.attachments ?? []
						const wantsUpload =
							storage.autoUpload !== false && rawAttachments.length > 0
						const wantsShorten =
							storage.autoShorten !== false && !!content.trim()

						if (!wantsUpload && !wantsShorten) {
							return orig.apply(target, args)
						}

						const uploadedUrls: string[] = []

						// 1. Intercept and upload attachments before sending
						if (wantsUpload) {
							showToast('Uploading to Zipline…')

							for (const raw of rawAttachments) {
								const { uri, name, type } = extractFileInfo(raw)
								if (!uri) continue

								try {
									const uploaded = await uploadFile(
										uri,
										name,
										type,
										token,
										storage.host,
									)
									uploadedUrls.push(uploaded.url)
								} catch (e: any) {
									api.logger.error(
										`${TAG} Failed to upload ${name}: ${e?.message ?? e}`,
									)
									showToast(`Zipline upload error: ${e?.message ?? e}`)
								}
							}

							if (uploadedUrls.length > 0) {
								// Strip native attachments so Discord does not upload or send them natively
								if (options) {
									if (options.attachmentsToUpload) {
										options.attachmentsToUpload = []
									}
									if (options.attachments) {
										options.attachments = []
									}
								}

								// Append Zipline links into message content
								const urlsBlock = uploadedUrls.join('\n')
								content = content ? `${content}\n${urlsBlock}` : urlsBlock
								message.content = content

								setClipboard(uploadedUrls[uploadedUrls.length - 1])
								showToast('Uploaded to Zipline (link copied)')
							}
						}

						// 2. Intercept and shorten links in content before sending
						if (wantsShorten) {
							const rawMatches = content.match(URL_REGEX) ?? []
							const urls = [...new Set(rawMatches)].filter(
								(u) => !isExcludedDomain(u, storage.host),
							)

							let shortenedCount = 0
							for (const url of urls) {
								try {
									const short = await shortenUrl(url, token, storage.host)
									content = content.split(url).join(short)
									shortenedCount++
								} catch (e: any) {
									api.logger.error(
										`${TAG} Failed to shorten ${url}: ${e?.message ?? e}`,
									)
								}
							}

							if (shortenedCount > 0) {
								message.content = content
							}
						}

						return orig.apply(target, args)
					},
				)
				cleanups.push(unpatch)
			} catch (e) {
				api.logger.error(`${TAG} Failed to patch sendMessage: ${e}`)
			}
		}

		// Hook MessageActions via module ID 7696 or filter lookup
		try {
			const mod = revenge.modules.metro.getInitializedModuleExports(
				MESSAGE_ACTION_CREATORS_MODULE_ID,
			)
			if (mod) patchMessageActions(mod)
		} catch {}

		try {
			const { filters, lookupModule, getModules } = revenge.modules.finders
			const filter = filters.withProps('sendMessage', 'editMessage')
			const matches = lookupModule(filter)
			for (const m of matches || []) patchMessageActions(m)
			const unsub = getModules(filter, (m) => patchMessageActions(m), {
				returnNamespace: true,
			})
			cleanups.push(() => unsub?.())
		} catch (e) {
			api.logger.error(`${TAG} Error finding MessageActions: ${e}`)
		}

		// Register Client Utils slash command if available
		try {
			const clientUtils =
				(revenge as any)?.plugins?.clientUtils ??
				(globalThis as any).__c_utils
			if (clientUtils?.registerCommand) {
				clientUtils.registerCommand(
					{
						name: 'zipline',
						displayName: 'zipline',
						description: 'Shorten a URL with your configured Zipline instance',
						options: [
							{
								type: 3, // String
								name: 'url',
								displayName: 'url',
								description: 'URL to shorten',
								required: true,
							},
							clientUtils.responseFormatOption,
							{
								type: 3,
								name: 'ephemeral',
								displayName: 'ephemeral',
								description: 'Show response only to you (optional)',
								required: false,
								choices: [
									{ name: 'True', displayName: 'True', value: 'true' },
								],
							},
						],
						execute: async (args: any, ctx: any) => {
							const isEphemeral =
								args.ephemeral === 'true' || args.ephemeral === 'yes'
							const storage = api.jsonStorage.cache || DEFAULT_STORAGE
							const token = storage.token?.trim()

							if (!token) {
								return ctx.reply({
									ephemeral: true,
									content:
										'❌ No Zipline token configured in Zipline plugin settings.',
								})
							}

							try {
								const shortUrl = await shortenUrl(
									args.url,
									token,
									storage.host,
								)
								setClipboard(shortUrl)

								if (args.format === 'embed' && clientUtils.builders) {
									const { EmbedBuilder } = clientUtils.builders
									const embed = new EmbedBuilder()
										.setTitle('Zipline Shortlink')
										.setDescription(`[${shortUrl}](${shortUrl})`)
										.setColor('#5865F2')
										.addFields(
											{ name: 'Original', value: args.url, inline: false },
											{ name: 'Shortened', value: shortUrl, inline: false },
										)
										.setFooter('Copied to clipboard!')

									return ctx.reply({
										ephemeral: isEphemeral,
										embed,
									})
								}

								ctx.reply({
									ephemeral: isEphemeral,
									content: `🔗 Shortened link: ${shortUrl} *(copied to clipboard)*`,
								})
							} catch (err: any) {
								ctx.reply({
									ephemeral: true,
									content: `❌ Zipline shorten error: ${err?.message || err}`,
								})
							}
						},
					},
					{
						id: 'dev.everestmcarthur.zipline',
						name: 'Zipline',
						description: 'Zipline attachment and URL tools',
					},
				)

				cleanups.push(() => {
					clientUtils.unregisterCommand('zipline')
				})
			}
		} catch (err) {
			api.logger.warn(`${TAG} Could not register slash command: ${err}`)
		}

		api.cleanup(() => {
			for (const fn of cleanups) {
				try {
					fn()
				} catch {}
			}
		})
	},

	SettingsComponent: Settings,
})
