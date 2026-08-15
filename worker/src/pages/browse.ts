import { escapeHtml, htmlShell } from '../theme'
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
		<header>
			<div class="brand">
				<div class="brand-mark">N</div>
				<div class="brand-name">${escapeHtml(index.name)}</div>
			</div>
			<nav><span>Plugins</span></nav>
		</header>
		<div class="wrap">
			<div class="page-title" style="margin-top: 22px;">Plugins</div>
			<div class="page-sub">${entries.length} available &middot; installs directly into Revenge Next</div>
			<div class="grid">${cards}</div>
		</div>`

	return htmlShell({
		title: index.name,
		description: index.description || 'Plugins for Revenge Next.',
		body,
	})
}
