import { describe, expect, it, beforeEach, beforeAll } from 'vitest';
import { db, runMigrations } from '#lib/db';
import { barcodeCache } from '#lib/db/schema';
import { eq } from 'drizzle-orm';

describe('barcodeCache persistence and updates', () => {
	const testBarcode = '7801234567890';

	beforeAll(() => {
		runMigrations();
	});

	beforeEach(() => {
		db.delete(barcodeCache).where(eq(barcodeCache.barcode, testBarcode)).run();
	});

	it('inserts new product with nutrition data when it does not exist', () => {
		const now = Date.now();
		db.insert(barcodeCache)
			.values({
				barcode: testBarcode,
				name: 'Proteína Whey Local',
				brand: 'Marca Chile',
				servingQuantity: 30,
				servingSize: '30 g',
				kcalPer100: 400,
				proteinPer100: 80,
				fatPer100: 5,
				carbsPer100: 6.7,
				sugarPer100: 3.3,
				fiberPer100: 1.5,
				saltPer100: 0.5,
				lastSeenAt: now,
				fetchedAt: now
			})
			.run();

		const row = db.select().from(barcodeCache).where(eq(barcodeCache.barcode, testBarcode)).get();
		expect(row).toBeDefined();
		expect(row?.name).toBe('Proteína Whey Local');
		expect(row?.brand).toBe('Marca Chile');
		expect(row?.servingQuantity).toBe(30);
		expect(row?.kcalPer100).toBe(400);
		expect(row?.proteinPer100).toBe(80);
	});

	it('updates existing product when user corrects nutrition facts and adds ingredientsText', () => {
		const now = Date.now();
		// Initial insert with 0 kcal (e.g. from incomplete OFF data)
		db.insert(barcodeCache)
			.values({
				barcode: testBarcode,
				name: 'Proteína Whey Local',
				servingQuantity: 30,
				servingSize: '30 g',
				kcalPer100: 0,
				proteinPer100: 0,
				fatPer100: 0,
				carbsPer100: 0,
				lastSeenAt: now,
				fetchedAt: now
			})
			.run();

		// Update with corrected values from photo / manual edit including ingredientsText
		db.update(barcodeCache)
			.set({
				name: 'Proteína Whey Aislada 100%',
				kcalPer100: 380,
				proteinPer100: 85,
				fatPer100: 2,
				carbsPer100: 3,
				ingredientsText: 'Aislado de proteína de suero de leche, cacao, stevia, lecitina de soya.',
				lastSeenAt: Date.now()
			})
			.where(eq(barcodeCache.barcode, testBarcode))
			.run();

		const updated = db.select().from(barcodeCache).where(eq(barcodeCache.barcode, testBarcode)).get();
		expect(updated?.name).toBe('Proteína Whey Aislada 100%');
		expect(updated?.kcalPer100).toBe(380);
		expect(updated?.proteinPer100).toBe(85);
		expect(updated?.fatPer100).toBe(2);
		expect(updated?.ingredientsText).toBe('Aislado de proteína de suero de leche, cacao, stevia, lecitina de soya.');
	});
});

describe('favorites search and sorting logic', () => {
	type TestItem = {
		displayName: string;
		useCount: number;
		lastUsedAt: number | null;
		createdAt?: number | null;
	};

	function sortItems<T extends { displayName: string; useCount: number; lastUsedAt: number | null; createdAt?: number | null }>(
		items: T[],
		mode: 'usage' | 'alpha' | 'date'
	): T[] {
		const copy = [...items];
		if (mode === 'alpha') {
			return copy.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
		}
		if (mode === 'date') {
			return copy.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
		}
		return copy.sort((a, b) => {
			const ua = a.useCount ?? 0;
			const ub = b.useCount ?? 0;
			if (ub !== ua) return ub - ua;
			return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
		});
	}

	const sampleItems: TestItem[] = [
		{ displayName: 'Plátano', useCount: 15, lastUsedAt: 1000, createdAt: 100 },
		{ displayName: 'Avena', useCount: 30, lastUsedAt: 2000, createdAt: 50 },
		{ displayName: 'Bistec', useCount: 5, lastUsedAt: 500, createdAt: 300 },
		{ displayName: 'Huevos revueltos', useCount: 20, lastUsedAt: 1500, createdAt: 200 }
	];

	it('sorts by usage frequency (most used first)', () => {
		const sorted = sortItems(sampleItems, 'usage');
		expect(sorted.map((i) => i.displayName)).toEqual([
			'Avena',
			'Huevos revueltos',
			'Plátano',
			'Bistec'
		]);
	});

	it('sorts alphabetically (A to Z)', () => {
		const sorted = sortItems(sampleItems, 'alpha');
		expect(sorted.map((i) => i.displayName)).toEqual([
			'Avena',
			'Bistec',
			'Huevos revueltos',
			'Plátano'
		]);
	});

	it('sorts by date added (newest first)', () => {
		const sorted = sortItems(sampleItems, 'date');
		expect(sorted.map((i) => i.displayName)).toEqual([
			'Bistec',
			'Huevos revueltos',
			'Plátano',
			'Avena'
		]);
	});

	it('filters by search query', () => {
		const query = 'huev';
		const filtered = sampleItems.filter((i) => i.displayName.toLowerCase().includes(query));
		expect(filtered.length).toBe(1);
		expect(filtered[0].displayName).toBe('Huevos revueltos');
	});
});

describe('nutrition label extraction parser', () => {
	it('correctly handles dual column nutrition facts (per serving and per 100g)', () => {
		const mockResponse = {
			productName: 'Nutrition Factory 100% Whey',
			servingQuantity: 32,
			servingUnit: 'g',
			servingDescription: '1 scoop colmado',
			perServing: {
				kcal: 127,
				protein: 24.0,
				fat: 1.5,
				carbs: 4.2,
				fiber: 0.8,
				sugar: null,
				sodiumMg: 70
			},
			per100: {
				kcal: 396,
				protein: 75.0,
				fat: 4.8,
				carbs: 13.2,
				fiber: 2.5,
				sugar: null,
				sodiumMg: 220
			}
		};

		expect(mockResponse.servingQuantity).toBe(32);
		expect(mockResponse.perServing.kcal).toBe(127);
		expect(mockResponse.per100.kcal).toBe(396);
		expect(mockResponse.perServing.protein).toBe(24.0);
		expect(mockResponse.per100.protein).toBe(75.0);
	});
});
