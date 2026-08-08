import { Design } from '@revenge-mod/discord/design'
import { ScrollView, View } from 'react-native'
import { TAG_DEFINITIONS } from '../../lib/getTag'
import ColorInput from '../ColorInput'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type { StaffTagsStorage, TagOverride } from '../../lib/types'

interface TagSettingsSectionProps {
	api: PluginApi<{ jsonStorage: StaffTagsStorage }>
	id: string
	defaultText: string
	defaultColor: string
}

/**
 * `Design` is read inside each component (not destructured at module top level): external
 * plugin bundles run via a bare `new Function('revenge', 'plugin', script)` call at preInit with
 * no Metro-style dependency ordering, so `revenge.discord.design.Design`'s fields aren't
 * guaranteed populated yet at that point. By the time these components actually render (the user
 * opened the plugin's settings page), Discord's design system is long since ready.
 */
function TagSettingsSection({
	api,
	id,
	defaultText,
	defaultColor,
}: TagSettingsSectionProps) {
	const { TableRowGroup, TableSwitchRow, TextInput } = Design
	const storage = api.jsonStorage.use()
	const settings: TagOverride = storage?.tags?.[id] ?? {}
	const enabled = settings.enabled !== false

	const update = (patch: TagOverride) => {
		api.jsonStorage.set({ tags: { [id]: patch } })
	}

	return (
		<TableRowGroup title={defaultText}>
			<TableSwitchRow
				label="Show this tag"
				value={enabled}
				onValueChange={(v: boolean) => update({ enabled: v })}
			/>
			<TextInput
				label="Tag text"
				placeholder={defaultText}
				value={settings.text ?? ''}
				editable={enabled}
				onChange={(v: string) => update({ text: v })}
			/>
			<TableSwitchRow
				label="Custom color"
				subLabel={`Default: ${defaultColor}`}
				value={!!settings.useCustomColor}
				disabled={!enabled}
				onValueChange={(v: boolean) => update({ useCustomColor: v })}
			/>
			{settings.useCustomColor && (
				<ColorInput
					title="Color"
					value={settings.color}
					placeholder={defaultColor}
					onChange={(v: string) => update({ color: v })}
				/>
			)}
			<TableSwitchRow
				label="Gradient"
				subLabel="Member list & profile only, chat tags stay solid"
				value={!!settings.useGradient}
				disabled={!enabled}
				onValueChange={(v: boolean) => update({ useGradient: v })}
			/>
			{settings.useGradient && (
				<ColorInput
					title="Gradient color"
					value={settings.gradientColor}
					onChange={(v: string) => update({ gradientColor: v })}
				/>
			)}
		</TableRowGroup>
	)
}

export default function Settings({
	api,
}: {
	api: PluginApi<{ jsonStorage: StaffTagsStorage }>
}) {
	const { TableRowGroup, TableSwitchRow } = Design
	const storage = api.jsonStorage.use()

	return (
		<ScrollView style={{ flex: 1 }}>
			<TableRowGroup title="General">
				<TableSwitchRow
					label="Use top role color"
					subLabel="Used when a tag has no custom color set"
					value={!!storage?.useRoleColor}
					onValueChange={(v: boolean) =>
						api.jsonStorage.set({ useRoleColor: v })
					}
				/>
			</TableRowGroup>
			{TAG_DEFINITIONS.map(def => (
				<TagSettingsSection
					key={def.id}
					api={api}
					id={def.id}
					defaultText={def.defaultText}
					defaultColor={def.defaultColor}
				/>
			))}
			<View style={{ height: 24 }} />
		</ScrollView>
	)
}
