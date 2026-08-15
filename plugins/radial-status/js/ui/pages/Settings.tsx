import { Design } from '@revenge-mod/discord/design'
import { ScrollView, View } from 'react-native'
import ColorInput from '../ColorInput'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type { RadialStatusStorage } from '../../lib/types'

const STATUSES: { key: string; label: string; defaultColor?: string }[] = [
	{ key: 'online', label: 'Online', defaultColor: '#23A55A' },
	{ key: 'idle', label: 'Idle', defaultColor: '#F0B232' },
	{ key: 'dnd', label: 'Do Not Disturb', defaultColor: '#F23F42' },
	{ key: 'offline', label: 'Offline', defaultColor: '#80848E' },
]

export default function Settings({
	api,
}: {
	api: PluginApi<{ jsonStorage: RadialStatusStorage }>
}) {
	const { TableRowGroup, TableSwitchRow, TextInput, Text } = Design
	const storage = api.jsonStorage.use()
	const colors = storage?.colors ?? {}

	return (
		<ScrollView style={{ flex: 1 }}>
			<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
				<Text variant="text-sm/normal" color="text-muted">
					Replaces the small presence dot on an avatar with a colored ring
					instead, per status below. Leave a status blank to keep showing the
					normal dot for it.
				</Text>
			</View>
			<TableRowGroup title="Enable">
				<TableSwitchRow
					label="Draw ring around avatars"
					value={!!storage?.enabled}
					onValueChange={(v: boolean) => api.jsonStorage.set({ enabled: v })}
				/>
			</TableRowGroup>
			<TableRowGroup title="Ring colors">
				{STATUSES.map(({ key, label, defaultColor }) => (
					<ColorInput
						key={key}
						title={label}
						value={colors[key]}
						placeholder={defaultColor}
						onChange={(v: string) =>
							api.jsonStorage.set({ colors: { [key]: v } })
						}
					/>
				))}
			</TableRowGroup>
			<TableRowGroup title="Ring size">
				<TextInput
					label="Ring thickness"
					placeholder="2"
					value={String(storage?.ringThickness ?? 2)}
					onChange={(v: string) => {
						const n = Number.parseFloat(v)
						if (!Number.isNaN(n) && n > 0)
							api.jsonStorage.set({ ringThickness: n })
					}}
				/>
			</TableRowGroup>
			<View style={{ height: 24 }} />
		</ScrollView>
	)
}
