import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { meals, mealComponents, genericFoods } from '#lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { componentMicrosPer100, effectiveGrams } from '#lib/server/nutrition';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 });

	const rows = db.select({
		id: mealComponents.id,
		productBarcode: mealComponents.productBarcode,
		genericFoodId: mealComponents.genericFoodId,
		customName: mealComponents.customName,
		displayName: mealComponents.displayName,
		imageUrl: mealComponents.imageUrl,
		amount: mealComponents.amount,
		unit: mealComponents.unit,
		gramsPerPiece: mealComponents.gramsPerPiece,
		kcalPer100: mealComponents.kcalPer100,
		proteinPer100: mealComponents.proteinPer100,
		fatPer100: mealComponents.fatPer100,
		carbsPer100: mealComponents.carbsPer100,
		sugarPer100: mealComponents.sugarPer100,
		fiberPer100: mealComponents.fiberPer100,
		saltPer100: mealComponents.saltPer100,
		kcal: mealComponents.kcal,
		microsJson: mealComponents.microsJson,
		category: genericFoods.category,
		date: meals.date,
		time: meals.time
	})
	.from(mealComponents)
	.innerJoin(meals, eq(mealComponents.mealId, meals.id))
	.leftJoin(genericFoods, eq(mealComponents.genericFoodId, genericFoods.id))
	.where(eq(meals.userId, user.id))
	.orderBy(desc(meals.date), desc(meals.time), desc(mealComponents.sortOrder))
	.limit(100)
	.all();

	const seen = new Set<string>();
	const recent = [];

	for (const r of rows) {
		const key = r.productBarcode
			? `barcode:${r.productBarcode}`
			: r.genericFoodId
			? `generic:${r.genericFoodId}`
			: `custom:${(r.displayName || '').toLowerCase().trim()}`;

		if (seen.has(key)) continue;
		seen.add(key);

		recent.push({
			id: r.id,
			productBarcode: r.productBarcode,
			genericFoodId: r.genericFoodId,
			customName: r.customName,
			displayName: r.displayName,
			imageUrl: r.imageUrl,
			amount: r.amount,
			unit: r.unit,
			gramsPerPiece: r.gramsPerPiece,
			category: r.category,
			kcalPer100: r.kcalPer100,
			proteinPer100: r.proteinPer100,
			fatPer100: r.fatPer100,
			carbsPer100: r.carbsPer100,
			sugarPer100: r.sugarPer100,
			fiberPer100: r.fiberPer100,
			saltPer100: r.saltPer100,
			kcal: r.kcal,
			micros: componentMicrosPer100(r.microsJson, effectiveGrams(r.amount, r.unit, r.gramsPerPiece)),
			lastUsedDate: r.date,
			lastUsedTime: r.time
		});

		if (recent.length >= 30) break;
	}

	return Response.json({ recent });
};
