import { setChannel, setSiteSettings, upsertOverride } from '../db'
import { checkAuth } from './auth'
import type { Env } from '../env'
import type { BaseIndex } from '../publicIndex'

const PLUGIN_ID_REGEX = /^[a-zA-Z0-9.-]+$/ // matches generate-index.ts's own validation exactly

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json' },
	})
}

const DEFAULT_MAIN_JS = `export default plugin({\n\tstart() {},\n})\n`

/** Returns null if `url.pathname` isn't an admin API route, so the caller can fall through. */
export async function handleAdminApi(
	request: Request,
	env: Env,
	url: URL,
): Promise<Response | null> {
	if (!url.pathname.startsWith('/api/admin/')) return null

	if (!checkAuth(request, env)) return json({ error: 'unauthorized' }, 401)

	if (url.pathname === '/api/admin/site' && request.method === 'PUT') {
		const body = await request
			.json<{ name?: string; description?: string }>()
			.catch(() => null)
		if (!body) return json({ error: 'invalid body' }, 400)

		await setSiteSettings(env, {
			name: body.name,
			description: body.description,
		})
		return json({ ok: true })
	}

	const overrideMatch = url.pathname.match(
		/^\/api\/admin\/overrides\/([\w.-]+)$/,
	)
	if (overrideMatch && request.method === 'PUT') {
		const id = overrideMatch[1]
		if (!PLUGIN_ID_REGEX.test(id)) return json({ error: 'invalid id' }, 400)

		const body = await request.json<Record<string, unknown>>().catch(() => null)
		if (!body) return json({ error: 'invalid body' }, 400)

		const patch: Parameters<typeof upsertOverride>[2] = {
			name: body.name as string | undefined,
			description: body.description as string | undefined,
			tagline: body.tagline as string | undefined,
			note: body.note as string | undefined,
			category: body.category as string | undefined,
			accent: body.accent as string | undefined,
			status: body.status as string | undefined,
			howItWorks: body.howItWorks as string | undefined,
			features: body.features as string[] | undefined,
			commands: body.commands as { cmd: string; desc: string }[] | undefined,
			limitations: body.limitations as string | undefined,
			hidden: body.hidden as boolean | undefined,
			isDraft: body.isDraft as boolean | undefined,
		}

		if (patch.isDraft) {
			const mainJs = (body.mainJs as string | undefined) ?? DEFAULT_MAIN_JS
			patch.mainJs = mainJs
			patch.manifest = JSON.stringify({
				format: 1,
				id,
				name: patch.name ?? id,
				description: patch.description ?? '',
				author: (body.author as string | undefined) ?? '',
				version: (body.version as string | undefined) ?? '0.0.1',
				dependencies: {
					'revenge.api': { version: '>=1 <2' },
					discord: { version: '*' },
				},
				dist: { script: 'index.js' },
			})
		}

		await upsertOverride(env, id, patch)
		return json({ ok: true })
	}

	const channelMatch = url.pathname.match(
		/^\/api\/admin\/channels\/([\w.-]+)\/([\w-]+)$/,
	)
	if (channelMatch && request.method === 'PUT') {
		const [, id, channel] = channelMatch
		const body = await request.json<{ version?: string }>().catch(() => null)
		if (!body?.version) return json({ error: 'version required' }, 400)

		// Mirrors generate-index.ts's own "Channel override points at unpublished version" check -
		// a channel can only ever point at a version that's actually in the built index.
		const baseRes = await env.ASSETS.fetch('https://internal/index.json')
		const base = await baseRes.json<BaseIndex>()
		const plugin = base.plugins[id]
		if (!plugin || !(body.version in plugin.versions)) {
			return json(
				{ error: `version '${body.version}' is not published for '${id}'` },
				400,
			)
		}

		await setChannel(env, id, channel, body.version)
		return json({ ok: true })
	}

	return json({ error: 'not found' }, 404)
}
