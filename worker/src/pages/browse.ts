import { escapeHtml, htmlShell, renderHeader } from '../theme'
import type { Override } from '../db'
import type { BaseIndex } from '../publicIndex'

export function renderBrowsePage(
	index: BaseIndex,
	overrides: Record<string, Override>,
): string {
	const entries = Object.entries(index.plugins)

	const cards = entries
		.map(([id, plugin]) => {
			const override = overrides[id]
			const version = plugin.channels.latest ?? Object.keys(plugin.versions)[0]
			const tagline = override?.tagline ?? plugin.description
			return `
				<div class="card">
					<div class="card-top">
						<div class="card-icon">${plugin.icon ? escapeHtml(plugin.icon) : '\u{1F9E9}'}</div>
						<div class="badge">STABLE</div>
					</div>
					<div class="card-name"><a href="/plugins/${encodeURIComponent(id)}">${escapeHtml(plugin.name)}</a></div>
					<div class="card-desc">${escapeHtml(tagline)}</div>
					<div class="card-foot">
						<div class="card-meta">${escapeHtml(plugin.author)} &middot; v${escapeHtml(version ?? '?')}</div>
						<a class="btn" href="/plugins/${encodeURIComponent(id)}">View</a>
					</div>
				</div>`
		})
		.join('')

	const body = `
		${renderHeader({ brandName: index.name })}
		<div class="wrap">
			<h1>Build different<span class="accent">.</span></h1>
			<div class="page-sub">Plugins for Revenge Next, made to be installed in seconds and to actually feel finished.</div>
			<div class="stats">
				<div class="stat"><b>${entries.length}</b><span>Plugins</span></div>
				<div class="stat"><b>100%</b><span>Open source</span></div>
				<div class="stat"><b>1-tap</b><span>Install</span></div>
			</div>
			<div class="grid">${cards}</div>
		</div>`

	return htmlShell({
		title: index.name,
		description: index.description || 'Plugins for Revenge Next.',
		body,
	})
}
