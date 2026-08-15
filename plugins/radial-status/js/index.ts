import patchRing from './patches/ring'
import Settings from './ui/pages/Settings'
import type { RadialStatusStorage } from './lib/types'

export default plugin<{ jsonStorage: RadialStatusStorage }>({
	jsonStorage: {
		load: true,
		default: {
			enabled: true,
			colors: {
				online: '#23A55A',
				idle: '#F0B232',
				dnd: '#F23F42',
			},
			ringThickness: 2,
		},
	},

	start(api) {
		let unpatch = () => {}
		try {
			unpatch = patchRing(api.jsonStorage)
		} catch (e) {
			api.logger.error(`[Radial Status] Failed to apply the ring patch: ${e}`)
		}
		api.cleanup(unpatch)
	},

	SettingsComponent: Settings,
})
