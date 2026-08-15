import { escapeHtml, htmlShell } from '../theme'
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

	const body = `
		<header>
			<div class="brand">
				<a href="/" class="brand-mark" style="text-decoration:none;">N</a>
				<div class="brand-name">${escapeHtml(plugin.name)}</div>
			</div>
			<nav><a href="/">All plugins</a></nav>
		</header>
		<div class="wrap">
			<div class="page-title" style="margin-top: 22px;">${escapeHtml(plugin.name)}</div>
			<div class="page-sub">${escapeHtml(tagline)}</div>
			<p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.75);">${escapeHtml(description)}</p>
			${featuresHtml}
			<div class="card-meta" style="margin: 16px 0;">${escapeHtml(plugin.author)} &middot; v${escapeHtml(version ?? '?')}</div>
			<a class="btn" href="/index.json">Add repository in Revenge Next</a>
		</div>`

	return htmlShell({
		title: `${plugin.name} - Revenge Next`,
		description: tagline,
		ogTitle: plugin.name,
		ogDescription: tagline,
		body,
	})
}
