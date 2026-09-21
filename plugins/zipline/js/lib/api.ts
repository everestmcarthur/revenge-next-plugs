const DEFAULT_HOST = 'i.allyapp.cc'
const UPLOAD_TIMEOUT_MS = 30000

export function formatHost(rawHost?: string): string {
	const h = rawHost?.trim()
	return (h || DEFAULT_HOST).replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function getBaseUrl(rawHost?: string): string {
	return `https://${formatHost(rawHost)}`
}

export function isExcludedDomain(url: string, rawHost?: string): boolean {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return true
	}

	const host = formatHost(rawHost)
	const excluded = [
		'discord.com',
		'discordapp.com',
		'cdn.discordapp.com',
		'media.discordapp.net',
		'discord.gg',
		host,
	]
	return excluded.some(
		(d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`),
	)
}

export interface UploadedFile {
	url: string
	name: string
}

function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	message: string,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms)
		promise.then(
			(v) => {
				clearTimeout(timer)
				resolve(v)
			},
			(e) => {
				clearTimeout(timer)
				reject(e)
			},
		)
	})
}

export async function uploadFile(
	fileUri: string,
	name: string,
	type: string,
	token: string,
	rawHost?: string,
): Promise<UploadedFile> {
	if (!token?.trim()) throw new Error('No Zipline token configured')

	const form = new FormData()
	form.append('file', {
		uri: fileUri,
		name: name || 'file.bin',
		type: type || 'application/octet-stream',
	} as any)

	const res = await withTimeout(
		fetch(`${getBaseUrl(rawHost)}/api/upload`, {
			method: 'POST',
			headers: { authorization: token.trim() },
			body: form,
		}),
		UPLOAD_TIMEOUT_MS,
		'Upload timed out',
	)

	if (!res.ok) {
		throw new Error(
			`Zipline upload failed (${res.status}): ${await res.text().catch(() => '')}`,
		)
	}

	const json = await res.json()
	const uploaded = json?.files?.[0]
	if (!uploaded?.url) {
		throw new Error('Zipline upload response was missing a file URL')
	}

	return { url: uploaded.url, name: uploaded.name }
}

export async function shortenUrl(
	destination: string,
	token: string,
	rawHost?: string,
): Promise<string> {
	if (!token?.trim()) throw new Error('No Zipline token configured')

	const res = await withTimeout(
		fetch(`${getBaseUrl(rawHost)}/api/user/urls`, {
			method: 'POST',
			headers: {
				authorization: token.trim(),
				'content-type': 'application/json',
			},
			body: JSON.stringify({ destination }),
		}),
		15000,
		'Shorten timed out',
	)

	if (!res.ok) {
		throw new Error(
			`Zipline shorten failed (${res.status}): ${await res.text().catch(() => '')}`,
		)
	}

	const json = await res.json()
	if (!json?.url) throw new Error('Zipline shorten response was missing a URL')

	return json.url
}
