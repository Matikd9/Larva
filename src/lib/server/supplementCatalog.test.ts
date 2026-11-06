import { describe, expect, it, beforeEach } from 'vitest';
import { db, sqlite } from '#lib/db';
import { supplementCatalog, supplementCatalogNutrients, supplements, supplementNutrients, users } from '#lib/db/schema';
import { eq, or, like } from 'drizzle-orm';
import { bootstrapSupplementCatalog, seedUserDefaultSupplements, ensureSupplementCatalogKeywordsColumn } from './supplementSeed';
import { CATALOG_SUPPLEMENTS, USER_ESSENTIAL_SUPPLEMENT_IDS } from './supplementCatalogSeed';
import { displayUnit, shortUnit } from '#lib/units';
import { randomUUID } from 'crypto';

describe('supplement catalog and default user seeding', () => {
	beforeEach(() => {
		ensureSupplementCatalogKeywordsColumn();
	});

	it('bootstraps the complete supplement catalog with all nutrients and keywords', () => {
		bootstrapSupplementCatalog();

		const catalogRows = db.select().from(supplementCatalog).all();
		expect(catalogRows.length).toBeGreaterThanOrEqual(CATALOG_SUPPLEMENTS.length);

		// Verify Creatine Monohydrate exists with nutrients
		const creatine = db.select().from(supplementCatalog).where(eq(supplementCatalog.id, 'sc-creatine-monohydrate')).get();
		expect(creatine).toBeDefined();
		expect(creatine?.name).toBe('Creatine Monohydrate');
		expect(creatine?.unit).toBe('g');
		expect(creatine?.keywords).toContain('creatina');

		const creatineNutrients = db
			.select()
			.from(supplementCatalogNutrients)
			.where(eq(supplementCatalogNutrients.catalogId, 'sc-creatine-monohydrate'))
			.all();
		expect(creatineNutrients.length).toBe(1);
		expect(creatineNutrients[0].name).toBe('Creatine');
		expect(creatineNutrients[0].amountPerUnit).toBe(1);
	});

	it('finds English supplements using Spanish search keywords', () => {
		bootstrapSupplementCatalog();

		function searchCatalog(query: string) {
			const q = query.trim();
			const qClean = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
			return db
				.select()
				.from(supplementCatalog)
				.where(
					or(
						like(supplementCatalog.name, `%${q}%`),
						like(supplementCatalog.name, `%${qClean}%`),
						like(supplementCatalog.brand, `%${q}%`),
						like(supplementCatalog.info, `%${q}%`),
						like(supplementCatalog.keywords, `%${q}%`),
						like(supplementCatalog.keywords, `%${qClean}%`)
					)
				)
				.all();
		}

		// Search Spanish: "creatina" -> Creatine Monohydrate
		const creatineResults = searchCatalog('creatina');
		expect(creatineResults.some((r) => r.name === 'Creatine Monohydrate')).toBe(true);

		// Search Spanish: "magnesio" -> Magnesium Bisglycinate
		const magnesiumResults = searchCatalog('magnesio');
		expect(magnesiumResults.some((r) => r.name === 'Magnesium Bisglycinate')).toBe(true);

		// Search Spanish: "aceite de pescado" -> Omega-3 Fish Oil
		const fishOilResults = searchCatalog('aceite de pescado');
		expect(fishOilResults.some((r) => r.name === 'Omega-3 Fish Oil')).toBe(true);

		// Search Spanish: "hierro" -> Iron (Ferrous Bisglycinate)
		const ironResults = searchCatalog('hierro');
		expect(ironResults.some((r) => r.name === 'Iron (Ferrous Bisglycinate)')).toBe(true);

		// Search Spanish with accents: "colágeno" and "colageno" -> Collagen Peptides
		const collagenResults1 = searchCatalog('colágeno');
		const collagenResults2 = searchCatalog('colageno');
		expect(collagenResults1.some((r) => r.name === 'Collagen Peptides')).toBe(true);
		expect(collagenResults2.some((r) => r.name === 'Collagen Peptides')).toBe(true);

		// Search Spanish with accents: "proteína" and "proteina" -> Whey Protein & Casein Protein
		const proteinResults = searchCatalog('proteína');
		expect(proteinResults.some((r) => r.name === 'Whey Protein')).toBe(true);
	});

	it('seeds the 8 essential supplements for a new user with 0 supplements', () => {
		const testUserId = 'test-supp-user-' + randomUUID();
		const now = Math.floor(Date.now() / 1000);
		db.insert(users)
			.values({
				id: testUserId,
				username: 'user-' + randomUUID().slice(0, 12),
				passwordHash: 'fixture-hash',
				role: 'user',
				createdAt: now,
				updatedAt: now
			})
			.run();

		// Ensure 0 supplements initially
		const initialCount = db
			.select()
			.from(supplements)
			.where(eq(supplements.userId, testUserId))
			.all().length;
		expect(initialCount).toBe(0);

		// Seed user
		const seededCount = seedUserDefaultSupplements(testUserId);
		expect(seededCount).toBe(8);

		const userSupps = db
			.select()
			.from(supplements)
			.where(eq(supplements.userId, testUserId))
			.orderBy(supplements.sortOrder)
			.all();

		expect(userSupps.length).toBe(8);

		const names = userSupps.map((s) => s.name);
		expect(names).toContain('Creatine Monohydrate');
		expect(names).toContain('Vitamin D3');
		expect(names).toContain('Magnesium Bisglycinate');
		expect(names).toContain('Omega-3 Fish Oil');
		expect(names).toContain('Multivitamin');
		expect(names).toContain('Zinc');
		expect(names).toContain('Vitamin C');
		expect(names).toContain('Melatonin');

		// All 8 must be active, with defaultAmount configured, and stockQuantity null
		for (const s of userSupps) {
			expect(s.active).toBe(true);
			expect(s.defaultAmount).toBeGreaterThan(0);
			expect(s.stockQuantity).toBeNull();
		}

		// Check that nutrients were inserted for these supplements
		const creatine = userSupps.find((s) => s.name === 'Creatine Monohydrate')!;
		const creatineNutrients = db
			.select()
			.from(supplementNutrients)
			.where(eq(supplementNutrients.supplementId, creatine.id))
			.all();
		expect(creatineNutrients.length).toBe(1);
		expect(creatineNutrients[0].name).toBe('Creatine');

		const omega = userSupps.find((s) => s.name === 'Omega-3 Fish Oil')!;
		const omegaNutrients = db
			.select()
			.from(supplementNutrients)
			.where(eq(supplementNutrients.supplementId, omega.id))
			.all();
		expect(omegaNutrients.length).toBe(2);
		expect(omegaNutrients.some((n) => n.name === 'EPA')).toBe(true);
		expect(omegaNutrients.some((n) => n.name === 'DHA')).toBe(true);

		// Second call to seedUserDefaultSupplements should do nothing (idempotent, no duplicates)
		const secondRunCount = seedUserDefaultSupplements(testUserId);
		expect(secondRunCount).toBe(0);

		// Clean up created user and supplements
		db.delete(supplementNutrients).where(eq(supplementNutrients.supplementId, creatine.id)).run();
		db.delete(supplements).where(eq(supplements.userId, testUserId)).run();
		db.delete(users).where(eq(users.id, testUserId)).run();
	});

	it('does not overwrite existing supplements if user already has some', () => {
		const testUserId = 'test-supp-user-' + randomUUID();
		const now = Math.floor(Date.now() / 1000);
		db.insert(users)
			.values({
				id: testUserId,
				username: 'user-' + randomUUID().slice(0, 12),
				passwordHash: 'fixture-hash',
				role: 'user',
				createdAt: now,
				updatedAt: now
			})
			.run();

		// Add 1 custom supplement manually
		db.insert(supplements)
			.values({
				id: 'custom-supp-' + randomUUID(),
				userId: testUserId,
				name: 'Custom Ginseng',
				unit: 'Kapsel',
				active: true,
				sortOrder: 0,
				createdAt: Date.now(),
				updatedAt: Date.now()
			})
			.run();

		// Seed should skip
		const seededCount = seedUserDefaultSupplements(testUserId);
		expect(seededCount).toBe(0);

		const currentSupps = db
			.select()
			.from(supplements)
			.where(eq(supplements.userId, testUserId))
			.all();
		expect(currentSupps.length).toBe(1);
		expect(currentSupps[0].name).toBe('Custom Ginseng');

		// Clean up
		db.delete(supplements).where(eq(supplements.userId, testUserId)).run();
		db.delete(users).where(eq(users.id, testUserId)).run();
	});

	it('translates supplement units to Spanish correctly', () => {
		expect(displayUnit('Kapsel', 'es')).toBe('Cápsula');
		expect(shortUnit('Kapsel', 'es')).toBe('Cáps.');
		expect(displayUnit('Tablette', 'es')).toBe('Comprimido');
		expect(shortUnit('Tablette', 'es')).toBe('Comp.');
		expect(displayUnit('Stück', 'es')).toBe('Pieza');
		expect(shortUnit('Stück', 'es')).toBe('Pz.');
		expect(displayUnit('Portion', 'es')).toBe('Porción');
		expect(shortUnit('Portion', 'es')).toBe('Porc.');
		expect(displayUnit('g', 'es')).toBe('g');
		expect(shortUnit('g', 'es')).toBe('g');
	});
});
