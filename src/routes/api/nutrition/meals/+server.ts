
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { meals, mealComponents, caffeineDrinks, caffeineLogs } from '#lib/db/schema';
import { and, eq, asc, gte, lte, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { effectiveGrams, mealCaffeineLogPrefix, componentMicrosPer100, buildMealComponentRows, isValidDateKey } from '#lib/server/nutrition';
import { timeZoneFromSettings, zonedDateTimeToTimestamp } from '#lib/timeZones';
import { aggregateMicroCoverage } from '#lib/micronutrients';

function isValidTime(t: unknown): t is string {
	return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 });

	const date = event.url.searchParams.get('date');
	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	// History: one row of totals per day, summed in SQL instead of shipping every component.
	if (event.url.searchParams.get('summary') === '1' && isValidDateKey(from) && isValidDateKey(to)) {
		const days = db.select({
			date: meals.date,
			meals: sql<number>`count(distinct ${meals.id})`,
			kcal: sql<number>`coalesce(sum(${mealComponents.kcal}), 0)`,
			protein: sql<number>`coalesce(sum(${mealComponents.protein}), 0)`,
			fat: sql<number>`coalesce(sum(${mealComponents.fat}), 0)`,
			carbs: sql<number>`coalesce(sum(${mealComponents.carbs}), 0)`,
			fiber: sql<number>`coalesce(sum(${mealComponents.fiber}), 0)`
		}).from(meals)
			.leftJoin(mealComponents, eq(mealComponents.mealId, meals.id))
			.where(and(eq(meals.userId, user.id), gte(meals.date, from), lte(meals.date, to)))
			.groupBy(meals.date)
			.orderBy(asc(meals.date))
			.all();
		return Response.json({ days });
	}

	// History: micronutrient sums for a range, with the share of kcal that actually reports each one.
	if (event.url.searchParams.get('micros') === '1' && isValidDateKey(from) && isValidDateKey(to)) {
		const components = db.select({ date: meals.date, kcal: mealComponents.kcal, microsJson: mealComponents.microsJson })
			.from(mealComponents)
			.innerJoin(meals, eq(mealComponents.mealId, meals.id))
			.where(and(eq(meals.userId, user.id), gte(meals.date, from), lte(meals.date, to)))
			.all();
		return Response.json({ ...aggregateMicroCoverage(components), loggedDays: new Set(components.map(c => c.date)).size });
	}

	let rows;
	if (isValidDateKey(date)) {
		rows = db.select().from(meals)
			.where(and(eq(meals.userId, user.id), eq(meals.date, date)))
			.orderBy(asc(meals.time))
			.all();
	} else if (isValidDateKey(from) && isValidDateKey(to)) {
		rows = db.select().from(meals)
			.where(and(
				eq(meals.userId, user.id),
				gte(meals.date, from),
				lte(meals.date, to)
			))
			.orderBy(asc(meals.date), asc(meals.time))
			.all();
	} else {
		return Response.json({ error: 'date (YYYY-MM-DD) or from+to required' }, { status: 400 });
	}

	if (rows.length === 0) return Response.json({ meals: [] });

	const mealIds = rows.map((m) => m.id);
	const allComponents = db.select().from(mealComponents)
		.where(inArray(mealComponents.mealId, mealIds))
		.orderBy(asc(mealComponents.sortOrder)).all();
	const byMeal = new Map<string, typeof allComponents>();
	for (const c of allComponents) {
		const arr = byMeal.get(c.mealId) ?? [];
		arr.push(c);
		byMeal.set(c.mealId, arr);
	}

	return Response.json({
		meals: rows.map((m) => ({
			...m,
			components: (byMeal.get(m.id) ?? []).map((c) => ({
				...c,
				micros: componentMicrosPer100(c.microsJson, effectiveGrams(c.amount, c.unit, c.gramsPerPiece))
			}))
		}))
	});
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const { name, date, time, components, imageUrl, favoriteName, caffeineDrinkIds } = body as {
			name?: string;
			date?: string;
			time?: string;
			components?: unknown;
			imageUrl?: string | null;
			favoriteName?: string | null;
			caffeineDrinkIds?: string[];
		};

		if (typeof name !== 'string' || !name.trim()) return Response.json({ error: 'name required' }, { status: 400 });
		if (!isValidDateKey(date)) return Response.json({ error: 'date YYYY-MM-DD required' }, { status: 400 });
		if (!isValidTime(time)) return Response.json({ error: 'time HH:MM required' }, { status: 400 });

		const now = Date.now();
		const mealId = randomUUID();
		const built = buildMealComponentRows(mealId, components);
		if ('error' in built) return Response.json({ error: built.error }, { status: 400 });

		db.transaction(() => {
			db.insert(meals).values({
				id: mealId,
				userId: user.id,
				name: name.trim().slice(0, 60),
				date,
				time,
				imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
				favoriteName: typeof favoriteName === 'string' && favoriteName.trim() ? favoriteName.trim().slice(0, 80) : null,
				createdAt: now,
				updatedAt: now
			}).run();

			for (const row of built.rows) db.insert(mealComponents).values(row).run();

			// Koffein-Spiegel: Für jede verknüpfte Koffein-Getränk-Vorlage zusätzlich einen
			// Koffein-Log anlegen (Nutrition → Koffein, eine Richtung). Menge + mg kommen
			// autoritativ aus dem Getränk; clientLogId bindet den Log an die Mahlzeit.
			const drinkIds = Array.isArray(caffeineDrinkIds)
				? [...new Set(caffeineDrinkIds.filter((d): d is string => typeof d === 'string' && !!d))]
				: [];
			if (drinkIds.length > 0) {
				const loggedAt = zonedDateTimeToTimestamp(date, time, timeZoneFromSettings(user.settings));
				for (const drinkId of drinkIds) {
					const drink = db.select().from(caffeineDrinks).where(eq(caffeineDrinks.id, drinkId)).get();
					if (!drink) continue;
					db.insert(caffeineLogs).values({
						id: randomUUID(),
						userId: user.id,
						drinkName: drink.name,
						amountMl: drink.defaultMl,
						caffeineMg: drink.caffeineMg,
						loggedAt,
						clientLogId: `${mealCaffeineLogPrefix(mealId)}${drinkId}`,
						createdAt: now
					}).run();
				}
			}
		});

		return Response.json({ id: mealId }, { status: 201 });
	} catch (e) {
		return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
