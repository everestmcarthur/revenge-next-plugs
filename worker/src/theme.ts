export const PAGE_CSS = `
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: linear-gradient(180deg, #0c0d12, #08090c);
		color: #fff;
		font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
		overflow-x: hidden;
	}
	a { color: inherit; text-decoration: none; }
	.wrap { max-width: 1040px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }
	header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 20px 32px; border-bottom: 1px solid rgba(255,255,255,0.07);
		position: relative; z-index: 1;
	}

	.bg-blobs { position: fixed; inset: 0; overflow: hidden; z-index: 0; pointer-events: none; }
	.bg-blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.32; animation: blobDrift ease-in-out infinite alternate; }
	.bg-blob.b1 { width: 440px; height: 440px; top: -100px; left: -80px; background: #9a8cff; animation-duration: 24s; }
	.bg-blob.b2 { width: 380px; height: 380px; top: 38%; right: -120px; background: #ff8fc7; animation-duration: 30s; animation-delay: -6s; }
	.bg-blob.b3 { width: 360px; height: 360px; bottom: -120px; left: 28%; background: #6fe3e8; animation-duration: 34s; animation-delay: -12s; }
	@keyframes blobDrift {
		0% { transform: translate(0,0) scale(1); }
		50% { transform: translate(40px,-30px) scale(1.08); }
		100% { transform: translate(-30px,20px) scale(0.95); }
	}

	.floaters { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
	.float-icon { position: absolute; opacity: 0.16; animation: floatDrift linear infinite; will-change: transform; }
	@keyframes floatDrift {
		0% { transform: translate(0,0) rotate(0deg); }
		25% { transform: translate(18px,-26px) rotate(6deg); }
		50% { transform: translate(-14px,-46px) rotate(-4deg); }
		75% { transform: translate(-22px,-16px) rotate(5deg); }
		100% { transform: translate(0,0) rotate(0deg); }
	}

	html.custom-cursor, html.custom-cursor a, html.custom-cursor button, html.custom-cursor input,
	html.custom-cursor textarea, html.custom-cursor .card, html.custom-cursor .chip { cursor: none; }
	.cursor-ring {
		position: fixed; top: 0; left: 0; width: 20px; height: 20px; border-radius: 50%;
		border: 1.5px solid rgba(154,140,255,0.85); pointer-events: none; z-index: 9999;
		transform: translate(-50%,-50%);
		transition: width 0.2s ease, height 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
	}
	.cursor-ring.hover { width: 42px; height: 42px; background: rgba(154,140,255,0.14); border-color: rgba(154,140,255,1); }
	@media (hover: none), (pointer: coarse) { .cursor-ring { display: none; } }
	.brand { display: flex; align-items: center; gap: 10px; }
	.brand-mark {
		width: 24px; height: 24px; border-radius: 7px; background: #15161c;
		border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center;
		justify-content: center; font-size: 12px; font-weight: 700; color: #9a8cff;
	}
	.brand-name { font-weight: 650; font-size: 14.5px; letter-spacing: -0.01em; }
	nav { display: flex; align-items: center; gap: 22px; font-size: 13px; color: rgba(255,255,255,0.5); }
	nav a:hover { color: rgba(255,255,255,0.85); }

	h1 { font-size: 58px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; margin: 0 0 16px; }
	h1 .accent { color: #9a8cff; }
	.page-title { font-size: 58px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; margin: 44px 0 16px; }
	.page-sub { font-size: 16.5px; color: rgba(255,255,255,0.55); max-width: 520px; line-height: 1.55; margin-bottom: 30px; }

	.stats { display: flex; gap: 36px; margin-bottom: 44px; padding-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.08); }
	.stat b { display: block; font-size: 30px; font-weight: 750; }
	.stat span { font-size: 12px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.04em; }

	.chip {
		background: transparent; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px;
		padding: 6px 13px; font-size: 12.5px; color: rgba(255,255,255,0.4); display: inline-block;
		transition: border-color 0.2s ease, color 0.2s ease;
	}
	.chip.active { background: #17181e; border-color: rgba(255,255,255,0.09); color: rgba(255,255,255,0.85); }

	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 4px 0 40px; }
	.card {
		background: #131318; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px;
		position: relative; overflow: hidden;
		transition: transform 0.3s cubic-bezier(.2,.8,.2,1), border-color 0.3s ease;
	}
	.card::before {
		content: ''; position: absolute; inset: 0; opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
		background: radial-gradient(160px 120px at 20% 0%, rgba(154,140,255,0.22), transparent 70%);
	}
	.card:hover { transform: translateY(-6px) scale(1.01); border-color: rgba(154,140,255,0.45); }
	.card:hover::before { opacity: 1; }
	.card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
	.card-icon {
		width: 34px; height: 34px; border-radius: 9px; background: #1a1b22;
		border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center;
		justify-content: center; font-size: 15px;
	}
	.badge {
		background: rgba(154,140,255,0.12); color: #b6acff; border: 1px solid rgba(154,140,255,0.25);
		font-size: 10px; font-weight: 650; padding: 3px 8px; border-radius: 5px;
	}
	.card-name { position: relative; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
	.card-desc { position: relative; font-size: 13.5px; color: rgba(255,255,255,0.55); margin-top: 6px; line-height: 1.5; }
	.card-foot { position: relative; display: flex; align-items: center; justify-content: space-between; margin-top: 18px; }
	.card-meta { font-size: 11.5px; color: rgba(255,255,255,0.4); }
	.btn {
		background: #e8e9ed; color: #0b0c10; font-size: 13px; font-weight: 650;
		padding: 8px 16px; border-radius: 8px; display: inline-block;
		transition: transform 0.2s ease, opacity 0.2s ease;
	}
	.btn:hover { transform: translateY(-2px); opacity: 0.92; }
	.btn-ghost {
		border: 1px solid rgba(255,255,255,0.16); color: #fff; font-size: 13px; font-weight: 600;
		padding: 8px 16px; border-radius: 8px; display: inline-block;
	}
`

export const SOURCE_URL =
	'https://github.com/everestmcarthur/revenge-next-plugs'
export const ISSUES_URL =
	'https://github.com/everestmcarthur/revenge-next-plugs/issues'

export function renderHeader(opts: {
	brandName: string
	brandHref?: string
}): string {
	const brandHref = opts.brandHref ?? '/'
	return `
		<header>
			<div class="brand">
				<a href="${brandHref}" class="brand-mark" style="text-decoration:none;">N</a>
				<div class="brand-name">${escapeHtml(opts.brandName)}</div>
			</div>
			<nav>
				<a href="/">Plugins</a>
				<a href="${SOURCE_URL}" target="_blank" rel="noopener">Source</a>
				<a href="${ISSUES_URL}" target="_blank" rel="noopener">Issues</a>
			</nav>
		</header>`
}

const FLOATERS = `
	<div class="bg-blobs"><div class="bg-blob b1"></div><div class="bg-blob b2"></div><div class="bg-blob b3"></div></div>
	<div class="floaters" aria-hidden="true">
		<span class="float-icon" style="top:12%;left:8%;font-size:34px;animation-duration:22s;">🏳️‍🌈</span>
		<span class="float-icon" style="top:65%;left:87%;font-size:26px;animation-duration:18s;animation-delay:-4s;">✨</span>
		<span class="float-icon" style="top:80%;left:15%;font-size:30px;animation-duration:26s;animation-delay:-9s;">🚀</span>
		<span class="float-icon" style="top:20%;left:92%;font-size:24px;animation-duration:20s;animation-delay:-3s;">⚡</span>
		<span class="float-icon" style="top:46%;left:50%;font-size:22px;animation-duration:28s;animation-delay:-14s;">🎮</span>
	</div>`

const CURSOR_SCRIPT = `
	<script>
	(function() {
		if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
		var ring = document.createElement('div')
		ring.className = 'cursor-ring'
		document.body.appendChild(ring)
		document.documentElement.classList.add('custom-cursor')
		var x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y
		addEventListener('mousemove', function (e) { x = e.clientX; y = e.clientY })
		function loop() {
			rx += (x - rx) * 0.22
			ry += (y - ry) * 0.22
			ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)'
			requestAnimationFrame(loop)
		}
		loop()
		document.addEventListener('mouseover', function (e) {
			if (e.target.closest && e.target.closest('a, button, .card, .chip, #install-card')) ring.classList.add('hover')
		})
		document.addEventListener('mouseout', function (e) {
			if (e.target.closest && e.target.closest('a, button, .card, .chip, #install-card')) ring.classList.remove('hover')
		})
	})()
	</script>`

export function htmlShell(opts: {
	title: string
	description: string
	ogTitle?: string
	ogDescription?: string
	body: string
}): string {
	const ogTitle = opts.ogTitle ?? opts.title
	const ogDescription = opts.ogDescription ?? opts.description
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDescription)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDescription)}">
<style>${PAGE_CSS}</style>
</head>
<body>${FLOATERS}${opts.body}${CURSOR_SCRIPT}</body>
</html>`
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
