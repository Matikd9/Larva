
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { meals, mealComponents, caffeineLogs } from '#lib/db/schema';
import { and, eq, like } from 'drizzle-orm';
import { mealCaffeineLogPrefix, buildMealComponentRows, isValidDateKey } from '#lib/server/nutrition';
import { timeZoneFromSettings, zonedDateTimeToTimestamp } from '#lib/timeZones';

function ensureOwn(userId: string, mealId: string) {
	const m = db.select().from(meals).where(and(eq(meals.id, mealId), eq(meals.userId, userId))).get();
	return m ?? null;
}

const mirroredCaffeineLogs = (userId: string, mealId: string) =>
	and(eq(caffeineLogs.userId, userId), like(caffeineLogs.clientLogId, `${mealCaffeineLogPrefix(mealId)}%`));

export const PATCH: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 });

	const meal = ensureOwn(user.id, event.params.id);
	if (!meal) return Response.json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const updates: Partial<typeof meals.$inferInsert> = { updatedAt: Date.now() };

		if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim().slice(0, 60);
		if (isValidDateKey(body.date)) updates.date = body.date;
		if (typeof body.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) updates.time = body.time;
		if ('imageUrl' in body) updates.imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : null;
		if ('favoriteName' in body) updates.favoriteName = typeof body.favoriteName === 'string' && body.favoriteName.trim() ? body.favoriteName.trim().slice(0, 80) : null;

		const built = Array.isArray(body.components) ? buildMealComponentRows(meal.id, body.components) : null;
		if (built && 'error' in built) return Response.json({ error: built.error }, { status: 400 });

		db.transaction(() => {
			db.update(meals).set(updates).where(eq(meals.id, meal.id)).run();

			// Wenn components dabei, ersetze alle
			if (built) {
				db.delete(mealComponents).where(eq(mealComponents.mealId, meal.id)).run();
				for (const row of built.rows) db.insert(mealComponents).values(row).run();
			}

			// Mirrored caffeine logs follow the meal when it moves to another day or time.
			if (updates.date || updates.time) {
				const loggedAt = zonedDateTimeToTimestamp(updates.date ?? meal.date, updates.time ?? meal.time, timeZoneFromSettings(user.settings));
				db.update(caffeineLogs).set({ loggedAt }).where(mirroredCaffeineLogs(user.id, meal.id)).run();
			}
		});

		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 });

	const meal = ensureOwn(user.id, event.params.id);
	if (!meal) return Response.json({ error: 'Not found' }, { status: 404 });

	db.delete(meals).where(eq(meals.id, meal.id)).run();
	// Gespiegelte Koffein-Logs dieser Mahlzeit mitlöschen (eine Richtung: Nutrition → Koffein).
	db.delete(caffeineLogs).where(mirroredCaffeineLogs(user.id, meal.id)).run();
	return Response.json({ ok: true });
};
