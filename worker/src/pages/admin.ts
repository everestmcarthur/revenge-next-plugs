import { htmlShell, renderHeader } from '../theme'

/**
 * Single-page admin UI: a token field gates everything else client-side (the real gate is
 * server-side, in handleAdminApi - this is just UX, not security). Once a token is entered, it
 * fetches /index.json for the plugin list and lets the admin PUT overrides/channels directly.
 */
export function renderAdminPage(): string {
	const body = `
		${renderHeader({ brandName: 'Admin' })}
		<div class="wrap" style="padding-top:22px;">
			<div id="gate">
				<div class="page-sub">Admin token</div>
				<input id="token" type="password" style="background:#15161c;border:1px solid rgba(255,255,255,0.12);color:#e8e9ed;padding:8px 10px;border-radius:6px;width:280px;">
				<button id="unlock" class="btn" style="border:none;cursor:pointer;margin-left:8px;">Unlock</button>
			</div>
			<div id="panel" style="display:none;"></div>
		</div>
		<script>
			const gate = document.getElementById('gate')
			const panel = document.getElementById('panel')
			let token = ''

			async function loadPlugins() {
				const res = await fetch('/index.json')
				const data = await res.json()
				panel.innerHTML = Object.entries(data.plugins).map(([id, p]) => \`
					<div class="card" style="margin-bottom:12px;">
						<div class="card-name">\${p.name} <span class="card-meta">(\${id})</span></div>
						<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
							<input placeholder="tagline" data-id="\${id}" data-field="tagline" style="background:#15161c;border:1px solid rgba(255,255,255,0.12);color:#e8e9ed;padding:6px 8px;border-radius:6px;flex:1;">
							<label style="font-size:11px;display:flex;align-items:center;gap:4px;"><input type="checkbox" data-id="\${id}" data-field="hidden"> hidden</label>
							<button data-id="\${id}" class="btn save" style="border:none;cursor:pointer;">Save</button>
						</div>
						<div style="margin-top:8px;display:flex;gap:8px;">
							<input placeholder="version" data-id="\${id}" data-channel="stable" style="background:#15161c;border:1px solid rgba(255,255,255,0.12);color:#e8e9ed;padding:6px 8px;border-radius:6px;width:100px;">
							<button data-id="\${id}" data-channel="stable" class="btn promote" style="border:none;cursor:pointer;">Promote to stable</button>
						</div>
					</div>
				\`).join('')

				panel.querySelectorAll('.save').forEach(btn => btn.addEventListener('click', async () => {
					const id = btn.dataset.id
					const tagline = panel.querySelector(\`[data-id="\${id}"][data-field="tagline"]\`).value
					const hidden = panel.querySelector(\`[data-id="\${id}"][data-field="hidden"]\`).checked
					await fetch(\`/api/admin/overrides/\${id}\`, {
						method: 'PUT',
						headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\` },
						body: JSON.stringify({ tagline, hidden }),
					})
					alert('Saved ' + id)
				}))

				panel.querySelectorAll('.promote').forEach(btn => btn.addEventListener('click', async () => {
					const id = btn.dataset.id
					const channel = btn.dataset.channel
					const version = panel.querySelector(\`[data-id="\${id}"][data-channel="\${channel}"]\`).value
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
				loadPlugins()
			})
		</script>`

	return htmlShell({
		title: 'Admin - Revenge Next',
		description: 'Admin panel',
		body,
	})
}
