export const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function isValidHex(value: string | undefined | null): value is string {
	return !!value && HEX_REGEX.test(value)
}
