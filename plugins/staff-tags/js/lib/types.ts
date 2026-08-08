export interface TagOverride {
	enabled?: boolean
	text?: string
	useCustomColor?: boolean
	color?: string
	useGradient?: boolean
	gradientColor?: string
}

export interface StaffTagsStorage {
	useRoleColor: boolean
	tags: Record<string, TagOverride>
}
