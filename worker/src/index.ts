import { handleAdminApi } from './admin/routes'
import { getAllChannels, getAllOverrides, getSiteSettings } from './db'
import { renderAdminPage } from './pages/admin'
import { renderBrowsePage } from './pages/browse'
import { renderDetailPage } from './pages/detail'
import { buildPublicIndex } from './publicIndex'
import type { Override } from './db'
import type { Env } from './env'
import type { BaseIndex } from './publicIndex'

async function loadMergedIndex(
	request: Request,
	env: Env,
): Promise<{
	merged: BaseIndex
	overrides: Record<string, Override>
	baseRes: Response
}> {
	const baseRes = await env.ASSETS.fetch(new URL('/index.json', request.url))
	const base = await baseRes.json<BaseIndex>()
	const [overrides, channels, siteSettings] = await Promise.all([
		getAllOverrides(env),
		getAllChannels(env),
		getSiteSettings(env),
	])
	const merged = buildPublicIndex(base, overrides, channels)
	if (siteSettings?.name) merged.name = siteSettings.name
	if (siteSettings?.description) merged.description = siteSettings.description

	return { merged, overrides, baseRes }
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)

		if (url.pathname === '/index.json') {
			const { baseRes, merged } = await loadMergedIndex(request, env)
			if (!baseRes.ok) return baseRes

			return new Response(JSON.stringify(merged), {
				headers: { 'content-type': 'application/json' },
			})
		}

		if (url.pathname === '/') {
			const { merged, overrides } = await loadMergedIndex(request, env)

			return new Response(renderBrowsePage(merged, overrides), {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			})
		}

		const detailMatch = url.pathname.match(/^\/plugins\/([\w.-]+)$/)
		if (detailMatch) {
			const id = detailMatch[1]
			const { merged, overrides } = await loadMergedIndex(request, env)

			const plugin = merged.plugins[id]
			if (!plugin) return new Response('Not found', { status: 404 })

			return new Response(renderDetailPage(plugin, overrides[id] ?? null), {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			})
		}

		if (url.pathname === '/admin') {
			return new Response(renderAdminPage(), {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			})
		}

		const adminApiRes = await handleAdminApi(request, env, url)
		if (adminApiRes) return adminApiRes

		return env.ASSETS.fetch(request)
	},
}
