import type { PageServerLoad } from './$types';
import { requireAuth } from '#lib/auth/middleware';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	if (!user) throw redirect(302, '/login');
	// Logging moved to the home screen; older notifications and shortcuts still link here.
	const action = event.url.searchParams.get('action');
	if (action) throw redirect(302, `/?action=${encodeURIComponent(action)}`);
	return { user: { id: user.id, username: user.username, role: user.role } };
};
