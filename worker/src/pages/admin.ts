import { htmlShell, renderHeader } from '../theme'

const INPUT_STYLE =
	'background:#15161c;border:1px solid rgba(255,255,255,0.12);color:#e8e9ed;padding:7px 9px;border-radius:6px;width:100%;font-family:inherit;font-size:12.5px;'

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

			async function loadState() {
				const res = await fetch('/api/admin/state', {
					headers: { authorization: \`Bearer \${token}\` },
				})
				return res.json()
			}

			function renderSite(state) {
				document.getElementById('site').innerHTML = \`
					<div class="card" style="margin-bottom:20px;">
						<div class="card-name">Site settings</div>
						\${fieldRow('site', 'name', 'Site name', state.site?.name)}
						\${fieldRow('site', 'description', 'Site description', state.site?.description, true)}
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
					init()
				})
			}

			function channelRows(id, existing) {
				const entries = Object.entries(existing ?? {})
				const rows = entries.length ? entries : [['', '']]
				return rows.map(([channel, version]) => \`
					<div style="display:flex;gap:8px;margin-bottom:6px;" class="channel-row">
						<input placeholder="channel name" value="\${channel}" data-channel-name style="\${INPUT_STYLE}width:140px;flex:none;">
						<input placeholder="version" value="\${version}" data-channel-version style="\${INPUT_STYLE}width:100px;flex:none;">
						<button data-id="\${id}" class="btn-ghost set-channel" style="border-width:1px;cursor:pointer;">Set</button>
					</div>\`).join('')
			}

			function renderPlugins(state) {
				const pluginsEl = document.getElementById('plugins')
				pluginsEl.innerHTML = Object.entries(state.base.plugins).map(([id, p]) => {
					const o = state.overrides[id] ?? {}
					const merged = { ...p, ...o }
					return \`
						<div class="card" style="margin-bottom:16px;">
							<div class="card-name">\${p.name} <span class="card-meta">(\${id})</span></div>
							<div style="margin-top:12px;">
								\${TEXT_FIELDS.map(([key, label]) => fieldRow(id, key, label, merged[key])).join('')}
								\${fieldRow(id, 'features', 'Features (JSON array of strings)', merged.features ? JSON.stringify(merged.features) : '', true)}
								\${fieldRow(id, 'commands', 'Commands (JSON array of {cmd, desc})', merged.commands ? JSON.stringify(merged.commands) : '', true)}
								<label style="font-size:11px;display:flex;align-items:center;gap:4px;margin-bottom:10px;">
									<input type="checkbox" data-id="\${id}" data-field="hidden" \${o.hidden ? 'checked' : ''}> hidden
								</label>
								<button data-id="\${id}" class="btn save" style="border:none;cursor:pointer;">Save</button>
							</div>
							<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);">
								<div style="font-size:10.5px;color:rgba(255,255,255,0.4);margin-bottom:6px;">Channels (any name - Next's client lists these for the user to pick)</div>
								<div class="channels" data-id="\${id}">\${channelRows(id, state.channels[id])}</div>
								<button data-id="\${id}" class="btn-ghost add-channel-row" style="border-width:1px;cursor:pointer;margin-top:4px;">+ Add channel</button>
							</div>
						</div>\`
				}).join('')

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
					init()
				}))

				pluginsEl.querySelectorAll('.add-channel-row').forEach(btn => btn.addEventListener('click', () => {
					const id = btn.dataset.id
					const container = pluginsEl.querySelector(\`.channels[data-id="\${id}"]\`)
					container.insertAdjacentHTML('beforeend', channelRows(id, { '': '' }))
					wireChannelButtons()
				}))

				wireChannelButtons()

				function wireChannelButtons() {
					pluginsEl.querySelectorAll('.set-channel').forEach(btn => {
						if (btn.dataset.wired) return
						btn.dataset.wired = '1'
						btn.addEventListener('click', async () => {
							const id = btn.dataset.id
							const row = btn.closest('.channel-row')
							const channel = row.querySelector('[data-channel-name]').value.trim()
							const version = row.querySelector('[data-channel-version]').value.trim()
							if (!channel || !version) return
							const res = await fetch(\`/api/admin/channels/\${id}/\${channel}\`, {
								method: 'PUT',
								headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\` },
								body: JSON.stringify({ version }),
							})
							const data = await res.json()
							if (!res.ok) {
								alert(data.error)
								return
							}
							init()
						})
					})
				}
			}

			async function init() {
				const state = await loadState()
				panel.innerHTML = '<div id="site"></div><div id="plugins"></div>'
				renderSite(state)
				renderPlugins(state)
			}

			document.getElementById('unlock').addEventListener('click', () => {
				token = document.getElementById('token').value
				gate.style.display = 'none'
				panel.style.display = 'block'
				init()
			})
		</script>`

	return htmlShell({
		title: 'Admin - Revenge Next',
		description: 'Admin panel',
		body,
	})
}
