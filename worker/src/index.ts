import { getAllChannels, getAllOverrides } from './db'
import { buildPublicIndex } from './publicIndex'
import type { Env } from './env'
import type { BaseIndex } from './publicIndex'

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)

		if (url.pathname === '/index.json') {
			const baseRes = await env.ASSETS.fetch(
				new URL('/index.json', request.url),
			)
			if (!baseRes.ok) return baseRes

			const base = await baseRes.json<BaseIndex>()
			const [overrides, channels] = await Promise.all([
				getAllOverrides(env),
				getAllChannels(env),
			])
			const merged = buildPublicIndex(base, overrides, channels)

			return new Response(JSON.stringify(merged), {
				headers: { 'content-type': 'application/json' },
			})
		}

		return env.ASSETS.fetch(request)
	},
}
