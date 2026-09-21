export interface ZiplineStorage {
	token?: string
	host?: string
	autoUpload: boolean
	autoShorten: boolean
}

export const DEFAULT_STORAGE: ZiplineStorage = {
	token: '',
	host: 'i.allyapp.cc',
	autoUpload: true,
	autoShorten: true,
}
