export const PAGE_CSS = `
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: #0b0c10;
		color: #e8e9ed;
		font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
	}
	a { color: inherit; text-decoration: none; }
	.wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; }
	header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.07);
	}
	.brand { display: flex; align-items: center; gap: 10px; }
	.brand-mark {
		width: 22px; height: 22px; border-radius: 6px; background: #15161c;
		border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center;
		justify-content: center; font-size: 11px; font-weight: 700; color: #9a8cff;
	}
	.brand-name { font-weight: 600; font-size: 13.5px; letter-spacing: -0.01em; }
	nav { display: flex; align-items: center; gap: 18px; font-size: 12px; color: rgba(255,255,255,0.5); }
	.page-title { font-size: 19px; font-weight: 650; letter-spacing: -0.015em; margin-bottom: 4px; }
	.page-sub { font-size: 12.5px; color: rgba(255,255,255,0.45); margin-bottom: 16px; }
	.chip {
		background: transparent; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px;
		padding: 5px 11px; font-size: 11.5px; color: rgba(255,255,255,0.4); display: inline-block;
	}
	.chip.active { background: #17181e; border-color: rgba(255,255,255,0.09); color: rgba(255,255,255,0.85); }
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 4px 0 24px; }
	.card {
		background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
		border: 1px solid rgba(255,255,255,0.08); border-radius: 11px; padding: 15px;
	}
	.card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
	.card-icon {
		width: 30px; height: 30px; border-radius: 8px; background: #1a1b22;
		border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center;
		justify-content: center; font-size: 13px;
	}
	.badge {
		background: rgba(154,140,255,0.12); color: #b6acff; border: 1px solid rgba(154,140,255,0.25);
		font-size: 9.5px; font-weight: 600; padding: 2px 7px; border-radius: 5px;
	}
	.card-name { font-size: 13.5px; font-weight: 600; letter-spacing: -0.005em; }
	.card-desc { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 3px; line-height: 1.4; }
	.card-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
	.card-meta { font-size: 10px; color: rgba(255,255,255,0.35); }
	.btn {
		background: #e8e9ed; color: #0b0c10; font-size: 10.5px; font-weight: 600;
		padding: 4px 10px; border-radius: 6px; display: inline-block;
	}
`

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
<body>${opts.body}</body>
</html>`
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
