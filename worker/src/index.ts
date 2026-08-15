import { getAllChannels, getAllOverrides } from './db'
import { renderBrowsePage } from './pages/browse'
import { renderDetailPage } from './pages/detail'
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

		if (url.pathname === '/') {
			const baseRes = await env.ASSETS.fetch(
				new URL('/index.json', request.url),
			)
			const base = await baseRes.json<BaseIndex>()
			const [overrides, channels] = await Promise.all([
				getAllOverrides(env),
				getAllChannels(env),
			])
			const merged = buildPublicIndex(base, overrides, channels)

			return new Response(renderBrowsePage(merged, overrides), {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			})
		}

		const detailMatch = url.pathname.match(/^\/plugins\/([\w.-]+)$/)
		if (detailMatch) {
			const id = detailMatch[1]
			const baseRes = await env.ASSETS.fetch(
				new URL('/index.json', request.url),
			)
			const base = await baseRes.json<BaseIndex>()
			const [overrides, channels] = await Promise.all([
				getAllOverrides(env),
				getAllChannels(env),
			])
			const merged = buildPublicIndex(base, overrides, channels)

			const plugin = merged.plugins[id]
			if (!plugin) return new Response('Not found', { status: 404 })

			return new Response(renderDetailPage(plugin, overrides[id] ?? null), {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			})
		}

		return env.ASSETS.fetch(request)
	},
}
