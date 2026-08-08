export const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function isValidHex(value: string | undefined | null): value is string {
	return !!value && HEX_REGEX.test(value)
}

/** Expands short form #abc to #aabbcc; leaves 6-digit hex untouched. */
export function normalizeHex(hex: string): string {
	if (hex.length === 4) {
		return `#${hex
			.slice(1)
			.split('')
			.map(c => c + c)
			.join('')}`
	}
	return hex
}

function hexToRgb(hex: string): number[] {
	return (normalizeHex(hex).match(/\w\w/g) ?? ['00', '00', '00']).map(x =>
		Number.parseInt(x, 16),
	)
}

function rgbToHex(rgb: number[]): string {
	return `#${rgb.map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`
}

export function interpolateColor(
	color1: string,
	color2: string,
	percentage: number,
): string {
	const rgb1 = hexToRgb(color1)
	const rgb2 = hexToRgb(color2)
	const interpolated = rgb1.map((c1, i) =>
		Math.round(c1 + (rgb2[i] - c1) * percentage),
	)

	return rgbToHex(interpolated)
}

/** Mixes a color toward white by `amount` (0-1). Stands in for chroma's `.brighten()` without a chroma-js module lookup. */
export function brighten(hex: string, amount: number): string {
	return interpolateColor(hex, '#FFFFFF', Math.max(0, Math.min(1, amount)))
}

/**
 * WCAG relative luminance (0 = black, 1 = white). Used to pick readable text color against a
 * background - stands in for chroma's `.get('lab.l')` threshold without a chroma-js module lookup.
 */
export function relativeLuminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex).map(c => {
		const s = c / 255
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Hardcoded Discord raw palette values (not exposed anywhere in @revenge-mod/types yet). */
export const rawColors = {
	WHITE_500: '#FFFFFF',
	BLACK_500: '#1E1F22',
}
