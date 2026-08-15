import type { Env } from '../env'

export function checkAuth(request: Request, env: Env): boolean {
	const auth = request.headers.get('authorization')
	return auth === `Bearer ${env.ADMIN_TOKEN}`
}
