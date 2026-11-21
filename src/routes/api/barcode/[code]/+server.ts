
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { lookupProduct } from '#lib/server/nutrition';

// Shopping-list scanner: the shared lookup also caches nutrition data, so a later
// nutrition lookup of the same product does not start from a name-only row.
export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const { code } = event.params;
	if (!code || !/^\d{8,14}$/.test(code)) {
		return Response.json({ name: null }, { status: 400 });
	}

	const product = await lookupProduct(code);
	return Response.json({ name: product?.name ?? null });
};
