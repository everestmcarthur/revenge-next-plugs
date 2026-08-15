import { htmlShell, renderHeader } from '../theme'

const INPUT_STYLE =
	'background:#15161c;border:1px solid rgba(255,255,255,0.12);color:#e8e9ed;padding:7px 9px;border-radius:6px;width:100%;font-family:inherit;font-size:12.5px;'

/**
 * Single-page admin UI: a token field gates everything else client-side (the real gate is
 * server-side, in handleAdminApi - this is just UX, not security). Once a token is entered, it
 * fetches /index.json for the plugin list and lets the admin PUT overrides/channels directly.
 *
 * Exposes every field the backend already supports (db.ts's Override type) - not just tagline
 * and hidden. `features`/`commands` are array-shaped, edited as raw JSON textareas rather than
 * a bespoke list editor for each - functional and complete over polished, matching "edit
 * anything" as the actual requirement here.
 */
export function renderAdminPage(): string {
	const body = `
		${renderHeader({ brandName: 'Admin' })}
		<div class="wrap" style="padding-top:22px;padding-bottom:60px;">
			<div id="gate">
				<div class="page-sub">Admin token</div>
				<input id="token" type="password" style="${INPUT_STYLE}max-width:280px;">
				<button id="unlock" class="btn" style="border:none;cursor:pointer;margin-left:8px;">Unlock</button>
			</div>
			<div id="panel" style="display:none;"></div>
		</div>
		<script>
			const gate = document.getElementById('gate')
			const panel = document.getElementById('panel')
			let token = ''

			const TEXT_FIELDS = [
				['name', 'Name'], ['description', 'Description'], ['tagline', 'Tagline'],
				['note', 'Note'], ['category', 'Category'], ['accent', 'Accent (hex)'],
				['status', 'Status'], ['howItWorks', 'How it works'], ['limitations', 'Limitations'],
			]

			function fieldRow(id, key, label, value, multiline) {
				const tag = multiline ? 'textarea rows="2"' : 'input'
				const closeTag = multiline ? 'textarea' : 'input'
				const valueAttr = multiline ? '' : \` value="\${(value ?? '').replace(/"/g, '&quot;')}"\`
				const inner = multiline ? (value ?? '') : ''
				return \`
					<div style="margin-bottom:8px;">
						<div style="font-size:10.5px;color:rgba(255,255,255,0.4);margin-bottom:3px;">\${label}</div>
						<\${tag} data-id="\${id}" data-field="\${key}" style="\${'${INPUT_STYLE}'}"\${valueAttr}>\${inner}</\${closeTag}>
					</div>\`
			}

			async function loadSiteSettings() {
				const res = await fetch('/index.json')
				const data = await res.json()
				document.getElementById('site').innerHTML = \`
					<div class="card" style="margin-bottom:20px;">
						<div class="card-name">Site settings</div>
						\${fieldRow('site', 'name', 'Site name', data.name)}
						\${fieldRow('site', 'description', 'Site description', data.description, true)}
						<button id="save-site" class="btn" style="border:none;cursor:pointer;">Save site settings</button>
					</div>\`

				document.getElementById('save-site').addEventListener('click', async () => {
					const name = document.querySelector('[data-id="site"][data-field="name"]').value
					const description = document.querySelector('[data-id="site"][data-field="description"]').value
					await fetch('/api/admin/site', {
						method: 'PUT',
						headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\` },
						body: JSON.stringify({ name, description }),
					})
					alert('Saved site settings')
				})
			}

			async function loadPlugins() {
				const res = await fetch('/index.json')
				const data = await res.json()
				const pluginsEl = document.getElementById('plugins')
				pluginsEl.innerHTML = Object.entries(data.plugins).map(([id, p]) => \`
					<div class="card" style="margin-bottom:16px;">
						<div class="card-name">\${p.name} <span class="card-meta">(\${id})</span></div>
						<div style="margin-top:12px;">
							\${TEXT_FIELDS.map(([key, label]) => fieldRow(id, key, label, p[key])).join('')}
							\${fieldRow(id, 'features', 'Features (JSON array of strings)', p.features ? JSON.stringify(p.features) : '', true)}
							\${fieldRow(id, 'commands', 'Commands (JSON array of {cmd, desc})', p.commands ? JSON.stringify(p.commands) : '', true)}
							<label style="font-size:11px;display:flex;align-items:center;gap:4px;margin-bottom:10px;">
								<input type="checkbox" data-id="\${id}" data-field="hidden"> hidden
							</label>
							<button data-id="\${id}" class="btn save" style="border:none;cursor:pointer;">Save</button>
						</div>
						<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;">
							<input placeholder="version" data-id="\${id}" data-channel="stable" style="\${'${INPUT_STYLE}'}width:100px;flex:none;">
							<button data-id="\${id}" data-channel="stable" class="btn promote" style="border:none;cursor:pointer;">Promote to stable</button>
						</div>
					</div>
				\`).join('')

				pluginsEl.querySelectorAll('.save').forEach(btn => btn.addEventListener('click', async () => {
					const id = btn.dataset.id
					const patch = {}
					for (const [key] of TEXT_FIELDS) {
						patch[key] = pluginsEl.querySelector(\`[data-id="\${id}"][data-field="\${key}"]\`).value
					}
					patch.hidden = pluginsEl.querySelector(\`[data-id="\${id}"][data-field="hidden"]\`).checked

					const featuresRaw = pluginsEl.querySelector(\`[data-id="\${id}"][data-field="features"]\`).value
					const commandsRaw = pluginsEl.querySelector(\`[data-id="\${id}"][data-field="commands"]\`).value
					try {
						if (featuresRaw) patch.features = JSON.parse(featuresRaw)
						if (commandsRaw) patch.commands = JSON.parse(commandsRaw)
					} catch {
						alert('Features/commands must be valid JSON')
						return
					}

					await fetch(\`/api/admin/overrides/\${id}\`, {
						method: 'PUT',
						headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\` },
						body: JSON.stringify(patch),
					})
					alert('Saved ' + id)
				}))

				pluginsEl.querySelectorAll('.promote').forEach(btn => btn.addEventListener('click', async () => {
					const id = btn.dataset.id
					const channel = btn.dataset.channel
					const version = pluginsEl.querySelector(\`[data-id="\${id}"][data-channel="\${channel}"]\`).value
					const res = await fetch(\`/api/admin/channels/\${id}/\${channel}\`, {
						method: 'PUT',
						headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\` },
						body: JSON.stringify({ version }),
					})
					const data = await res.json()
					alert(res.ok ? \`Promoted \${id}@\${version} to \${channel}\` : data.error)
				}))
			}

			document.getElementById('unlock').addEventListener('click', () => {
				token = document.getElementById('token').value
				gate.style.display = 'none'
				panel.style.display = 'block'
				panel.innerHTML = '<div id="site"></div><div id="plugins"></div>'
				loadSiteSettings()
				loadPlugins()
			})
		</script>`

	return htmlShell({
		title: 'Admin - Revenge Next',
		description: 'Admin panel',
		body,
	})
}
