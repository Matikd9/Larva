import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Nutrition moved to the home screen; installed PWAs, bookmarks and old notifications still use this path.
export const GET: RequestHandler = ({ url }) => redirect(308, `/${url.search}`);
