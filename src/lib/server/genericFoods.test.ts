import { describe, it, expect, beforeAll } from 'vitest';
import { GENERIC_FOODS } from './genericFoodsSeed';
import { db, sqlite } from '#lib/db';
import { genericFoods, appMeta } from '#lib/db/schema';
import { sql, or, like, eq } from 'drizzle-orm';

describe('Generic Foods Database & Spanish Localization', () => {
	beforeAll(() => {
		// Ensure generic_foods columns exist
		for (const colSql of [
			'ALTER TABLE generic_foods ADD COLUMN name_es TEXT',
			'ALTER TABLE generic_foods ADD COLUMN keywords_es TEXT',
			'ALTER TABLE generic_foods ADD COLUMN cooking_state TEXT',
			'ALTER TABLE generic_foods ADD COLUMN counterpart_id TEXT'
		]) {
			try {
				sqlite.exec(colSql);
			} catch {}
		}

		const insert = sqlite.prepare(`
			INSERT INTO generic_foods (
				id, category, name_de, name_en, name_es, keywords_de, keywords_en, keywords_es,
				cooking_state, counterpart_id,
				kcal_per_100, protein_per_100, fat_per_100, carbs_per_100,
				sugar_per_100, fiber_per_100, salt_per_100,
				default_piece_weight, default_unit, sort_order
			) VALUES (
				@id, @category, @name_de, @name_en, @name_es, @keywords_de, @keywords_en, @keywords_es,
				@cooking_state, @counterpart_id,
				@kcal, @protein, @fat, @carbs, @sugar, @fiber, @salt,
				@piece_weight, @default_unit, @sort_order
			)
			ON CONFLICT(id) DO UPDATE SET
				category = excluded.category,
				name_de = excluded.name_de,
				name_en = excluded.name_en,
				name_es = excluded.name_es,
				keywords_de = excluded.keywords_de,
				keywords_en = excluded.keywords_en,
				keywords_es = excluded.keywords_es,
				cooking_state = excluded.cooking_state,
				counterpart_id = excluded.counterpart_id,
				kcal_per_100 = excluded.kcal_per_100,
				protein_per_100 = excluded.protein_per_100,
				fat_per_100 = excluded.fat_per_100,
				carbs_per_100 = excluded.carbs_per_100,
				sugar_per_100 = excluded.sugar_per_100,
				fiber_per_100 = excluded.fiber_per_100,
				salt_per_100 = excluded.salt_per_100,
				default_piece_weight = excluded.default_piece_weight,
				default_unit = excluded.default_unit,
				sort_order = excluded.sort_order
		`);

		const tx = sqlite.transaction((items: typeof GENERIC_FOODS) => {
			for (let i = 0; i < items.length; i++) {
				const f = items[i];
				insert.run({
					id: f.id,
					category: f.category,
					name_de: f.nameDe,
					name_en: f.nameEn,
					name_es: f.nameEs ?? null,
					keywords_de: f.keywordsDe ?? null,
					keywords_en: f.keywordsEn ?? null,
					keywords_es: f.keywordsEs ?? null,
					cooking_state: f.cookingState ?? null,
					counterpart_id: f.counterpartId ?? null,
					kcal: f.kcalPer100,
					protein: f.proteinPer100 ?? null,
					fat: f.fatPer100 ?? null,
					carbs: f.carbsPer100 ?? null,
					sugar: f.sugarPer100 ?? null,
					fiber: f.fiberPer100 ?? null,
					salt: f.saltPer100 ?? null,
					piece_weight: f.defaultPieceWeight ?? null,
					default_unit: f.defaultUnit ?? 'g',
					sort_order: i
				});
			}
		});
		tx(GENERIC_FOODS);
	});

	it('contains basic staple foods in Spanish', () => {
		const egg = GENERIC_FOODS.find((f) => f.id === 'egg-boiled');
		expect(egg).toBeDefined();
		expect(egg?.nameEs).toContain('Huevo');
		expect(egg?.cookingState).toBe('cooked');
		expect(egg?.counterpartId).toBe('egg-raw');

		const steak = GENERIC_FOODS.find((f) => f.id === 'beef-steak-cooked');
		expect(steak).toBeDefined();
		expect(steak?.nameEs).toContain('Bistec');
		expect(steak?.cookingState).toBe('cooked');
		expect(steak?.counterpartId).toBe('beef-steak-raw');

		const mash = GENERIC_FOODS.find((f) => f.id === 'mashed-potatoes');
		expect(mash).toBeDefined();
		expect(mash?.nameEs).toContain('Puré de papas');
		expect(mash?.keywordsEs).toContain('pure');

		const riceCooked = GENERIC_FOODS.find((f) => f.id === 'rice-white-cooked');
		const riceRaw = GENERIC_FOODS.find((f) => f.id === 'rice-white-raw');
		expect(riceCooked?.counterpartId).toBe('rice-white-raw');
		expect(riceRaw?.counterpartId).toBe('rice-white-cooked');
	});

	it('searches staple foods in database using Spanish keywords', () => {
		const searchInDb = (q: string) => {
			const pattern = `%${q.toLowerCase()}%`;
			return db
				.select()
				.from(genericFoods)
				.where(
					or(
						like(sql`lower(coalesce(${genericFoods.nameEs}, ''))`, pattern),
						like(sql`lower(coalesce(${genericFoods.keywordsEs}, ''))`, pattern)
					)
				)
				.all();
		};

		const huevos = searchInDb('huevo');
		expect(huevos.length).toBeGreaterThan(0);
		expect(huevos.some((h) => h.id === 'egg-boiled' || h.id === 'egg-raw')).toBe(true);

		const bistec = searchInDb('bistec');
		expect(bistec.length).toBeGreaterThan(0);
		expect(bistec.some((b) => b.id === 'beef-steak-cooked' || b.id === 'beef-steak-raw')).toBe(true);

		const pure = searchInDb('pure');
		expect(pure.length).toBeGreaterThan(0);
		expect(pure.some((p) => p.id === 'mashed-potatoes')).toBe(true);

		const arroz = searchInDb('arroz');
		expect(arroz.length).toBeGreaterThan(0);
		expect(arroz.some((a) => a.id === 'rice-white-cooked')).toBe(true);
	});

	it('supports unaccented Spanish queries finding English items', () => {
		// Test stripAccents normalization logic
		const stripAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

		const searchBilingual = (q: string) => {
			const qNorm = stripAccents(q.toLowerCase());
			const pattern = `%${q.toLowerCase()}%`;
			const patternNorm = `%${qNorm}%`;
			const patterns = qNorm !== q.toLowerCase() ? [pattern, patternNorm] : [pattern];

			const conditions = [];
			for (const p of patterns) {
				conditions.push(
					like(sql`lower(coalesce(${genericFoods.nameEs}, ''))`, p),
					like(sql`lower(${genericFoods.nameEn})`, p),
					like(sql`lower(coalesce(${genericFoods.keywordsEs}, ''))`, p),
					like(sql`lower(coalesce(${genericFoods.keywordsEn}, ''))`, p)
				);
			}

			return db
				.select()
				.from(genericFoods)
				.where(or(...conditions))
				.all();
		};

		// "platano" (without accent) finds banana
		const platanoResults = searchBilingual('platano');
		expect(platanoResults.some((r) => r.id === 'banana-raw')).toBe(true);

		// "limon" (without accent) finds lemon
		const limonResults = searchBilingual('limon');
		expect(limonResults.some((r) => r.id === 'lemon-raw')).toBe(true);

		// "arandanos" (without accent) finds blueberries
		const arandanosResults = searchBilingual('arandanos');
		expect(arandanosResults.some((r) => r.id === 'blueberry-raw')).toBe(true);
	});
});
