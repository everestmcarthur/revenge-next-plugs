import {
	escapeHtml,
	htmlShell,
	ISSUES_URL,
	renderHeader,
	SOURCE_URL,
} from '../theme'
import type { Override } from '../db'
import type { IndexPlugin } from '../publicIndex'

export function renderDetailPage(
	plugin: IndexPlugin,
	override: Override | null,
): string {
	const description = override?.description ?? plugin.description
	const tagline = override?.tagline ?? description
	const version = plugin.channels.latest ?? Object.keys(plugin.versions)[0]

	const featuresHtml = override?.features?.length
		? `<ul>${override.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
		: ''

	const repoUrl = 'https://next.jarviscli.dev/index.json'

	const body = `
		${renderHeader({ brandName: plugin.name })}
		<div class="wrap">
			<h1 class="page-title" style="font-size:42px;">${escapeHtml(plugin.name)}</h1>
			<div class="page-sub">${escapeHtml(tagline)}</div>
			<p style="font-size:14.5px;line-height:1.65;color:rgba(255,255,255,0.75);max-width:560px;">${escapeHtml(description)}</p>
			${featuresHtml}
			<div class="card-meta" style="margin: 18px 0 26px;">${escapeHtml(plugin.author)} &middot; v${escapeHtml(version ?? '?')}</div>

			<div class="card" style="max-width:560px;margin-bottom:24px;">
				<div class="card-name" style="font-size:15px;">Install</div>
				<div class="card-desc">In Revenge Next, add this repository by URL:</div>
				<div style="background:#0b0c10;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;margin-top:10px;font-family:ui-monospace,monospace;font-size:12.5px;color:#b6acff;word-break:break-all;">${escapeHtml(repoUrl)}</div>
			</div>

			<div style="display:flex;gap:12px;">
				<a class="btn" href="${escapeHtml(repoUrl)}">Add repository</a>
				<a class="btn-ghost" href="${SOURCE_URL}" target="_blank" rel="noopener">View source</a>
				<a class="btn-ghost" href="${ISSUES_URL}" target="_blank" rel="noopener">Report an issue</a>
			</div>
		</div>`

	return htmlShell({
		title: `${plugin.name} - Revenge Next`,
		description: tagline,
		ogTitle: plugin.name,
		ogDescription: tagline,
		body,
	})
}
