import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/db', async () => {
	const { default: Database } = await import('better-sqlite3');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const schema = await import('#lib/db/schema');
	const sqlite = new Database(':memory:');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './src/lib/db/migrations' });
	// Added by a startup patch, not a migration (see ensureMicrosColumns).
	sqlite.exec('ALTER TABLE barcode_cache ADD COLUMN micros_json text');
	return { db, sqlite };
});

import { db } from '#lib/db';
import { barcodeCache } from '#lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildMealComponentRows, componentMicrosPer100, isValidDateKey, searchOff } from './nutrition';

describe('meal component validation', () => {
	const base = { displayName: 'Skyr', amount: 2, unit: 'portion', gramsPerPiece: 150, kcalPer100: 60 };

	it('computes totals and skips empty editor rows', () => {
		const result = buildMealComponentRows('m1', [base, { ...base, amount: 0 }]);
		expect('rows' in result && result.rows).toEqual([expect.objectContaining({ mealId: 'm1', kcal: 180, gramsPerPiece: 150 })]);
	});

	it.each([
		[{ ...base, kcalPer100: -5 }],
		[{ ...base, proteinPer100: 'lots' }],
		[{ ...base, gramsPerPiece: null }],
		[{ ...base, amount: Infinity }]
	])('rejects invalid input %#', (component) => {
		expect(buildMealComponentRows('m1', [component])).toHaveProperty('error');
	});

	it('only accepts real calendar dates', () => {
		expect(isValidDateKey('2024-02-29')).toBe(true);
		expect(isValidDateKey('2023-02-29')).toBe(false);
		expect(isValidDateKey('2024-99-99')).toBe(false);
	});
});
import { scaleMicros } from '#lib/micronutrients';

describe('meal component micros', () => {
	it('round-trips stored totals through the per-100 g API form without drifting', () => {
		const stored = JSON.stringify({ calciumMg: 300, ironMg: 1.5 }); // a 250 g component
		const per100 = componentMicrosPer100(stored, 250);
		expect(per100).toEqual({ calciumMg: 120, ironMg: 0.6 });
		expect(scaleMicros(per100, 250 / 100)).toEqual({ calciumMg: 300, ironMg: 1.5 });
		expect(componentMicrosPer100(stored, 0)).toEqual({});
	});
});

function cached(barcode: string, userEditedAt: number | null) {
	db.insert(barcodeCache).values({ barcode, name: 'Corrected', kcalPer100: 380, userEditedAt, lastSeenAt: 1 }).run();
}

describe('barcode cache refresh from Open Food Facts', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('keeps manual corrections but refreshes untouched products', async () => {
		cached('7800000000001', 123);
		cached('7800000000002', null);
		const hit = (code: string) => ({ code, product_name: 'From OFF', nutriments: { 'energy-kcal_100g': 500 } });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ hits: [hit('7800000000001'), hit('7800000000002')] })));

		await searchOff('anything');

		const edited = db.select().from(barcodeCache).where(eq(barcodeCache.barcode, '7800000000001')).get();
		const untouched = db.select().from(barcodeCache).where(eq(barcodeCache.barcode, '7800000000002')).get();
		expect(edited).toMatchObject({ name: 'Corrected', kcalPer100: 380 });
		expect(untouched).toMatchObject({ name: 'From OFF', kcalPer100: 500 });
	});
});
