
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { mealPlanEntries, recipes } from '#lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { now as dbNow } from '#lib/auth';

// GET /api/meal-plan?from=2026-04-14&to=2026-04-20
export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	if (!from || !to) return Response.json({ error: 'from and to required' }, { status: 400 });

	const entries = db
		.select({
			id: mealPlanEntries.id,
			date: mealPlanEntries.date,
			recipeId: mealPlanEntries.recipeId,
			note: mealPlanEntries.note,
			servings: mealPlanEntries.servings,
			recipeTitle: recipes.title,
			recipeImageUrl: recipes.imageUrl,
			recipeServings: recipes.servings
		})
		.from(mealPlanEntries)
		.leftJoin(recipes, and(eq(mealPlanEntries.recipeId, recipes.id), eq(recipes.userId, user!.id)))
		.where(
			and(
				eq(mealPlanEntries.userId, user!.id),
				gte(mealPlanEntries.date, from),
				lte(mealPlanEntries.date, to)
			)
		)
		.all();

	return Response.json(entries);
};

// PUT /api/meal-plan — create a new entry for a date
// Body: { date, recipeId?, note?, servings? }
export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { id: clientId, date, recipeId, note, servings } = body;

		if (typeof clientId === 'string' && clientId.trim().length > 0 && clientId.length <= 64) {
			const existing = db.select({ id: mealPlanEntries.id }).from(mealPlanEntries)
				.where(and(eq(mealPlanEntries.id, clientId.trim()), eq(mealPlanEntries.userId, user!.id)))
				.get();
			if (existing) return Response.json({ id: existing.id, deduped: true }, { status: 200 });
		}

		if (!date || typeof date !== 'string') return Response.json({ error: 'date required' }, { status: 400 });

		const hasContent = recipeId || (note && note.trim());
		if (!hasContent) return Response.json({ error: 'content required' }, { status: 400 });
		if (recipeId != null && (typeof recipeId !== 'string' || !db.select({ id: recipes.id }).from(recipes).where(and(eq(recipes.id, recipeId), eq(recipes.userId, user!.id))).get())) {
			return Response.json({ error: 'Rezept nicht gefunden' }, { status: 404 });
		}

		const ts = dbNow();
		const id = (typeof clientId === 'string' && clientId.trim().length > 0 && clientId.length <= 64) ? clientId.trim() : randomUUID();
		db.insert(mealPlanEntries).values({
			id,
			userId: user!.id,
			date,
			recipeId: recipeId ?? null,
			note: note?.trim() ?? null,
			servings: servings ?? null,
			createdAt: ts,
			updatedAt: ts
		}).run();
		return Response.json({ id });
	} catch (e) {
		console.error('PUT /api/meal-plan error:', e);
		return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
