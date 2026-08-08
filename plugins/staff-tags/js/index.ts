import { applyPatches } from './lib/applyPatches'
import patchChat from './patches/chat'
import patchDetails from './patches/details'
import patchName from './patches/name'
import patchTag from './patches/tag'
import Settings from './ui/pages/Settings'
import type { StaffTagsStorage } from './lib/types'

export default plugin<{ jsonStorage: StaffTagsStorage }>({
	jsonStorage: {
		load: true,
		default: { useRoleColor: false, tags: {} },
	},

	start(api) {
		const unpatchAll = applyPatches('Staff Tags', api.logger, {
			tag: patchTag,
			chat: () => patchChat(api.jsonStorage),
			name: () => patchName(api.jsonStorage),
			details: () => patchDetails(api.jsonStorage),
		})

		api.cleanup(unpatchAll)
	},

	SettingsComponent: Settings,
})
