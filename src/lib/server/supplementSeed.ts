import { db, sqlite } from '#lib/db';
import { appMeta, supplements, users } from '#lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { CATALOG_SUPPLEMENTS, USER_ESSENTIAL_SUPPLEMENT_IDS } from './supplementCatalogSeed';

export const SUPPLEMENT_CATALOG_VERSION = '1';

export function ensureSupplementCatalogKeywordsColumn() {
	try {
		const cols = sqlite.prepare(`PRAGMA table_info(supplement_catalog)`).all() as Array<{ name: string }>;
		if (!cols.some((c) => c.name === 'keywords')) {
			sqlite.exec(`ALTER TABLE supplement_catalog ADD COLUMN keywords text`);
		}
	} catch {}
}

export function bootstrapSupplementCatalog() {
	ensureSupplementCatalogKeywordsColumn();

	const meta = db.select().from(appMeta).where(eq(appMeta.key, 'supplement_catalog_version')).get();
	if (meta?.value === SUPPLEMENT_CATALOG_VERSION) return;

	const now = Date.now();

	const insertCatalog = sqlite.prepare(`
		INSERT INTO supplement_catalog (
			id, name, unit, brand, info, keywords, package_size, created_at, updated_at
		) VALUES (
			@id, @name, @unit, @brand, @info, @keywords, @package_size, @created_at, @updated_at
		)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			unit = excluded.unit,
			brand = excluded.brand,
			info = excluded.info,
			keywords = excluded.keywords,
			package_size = excluded.package_size,
			updated_at = excluded.updated_at
	`);

	const deleteNutrients = sqlite.prepare(`
		DELETE FROM supplement_catalog_nutrients WHERE catalog_id = ?
	`);

	const insertNutrient = sqlite.prepare(`
		INSERT INTO supplement_catalog_nutrients (
			id, catalog_id, name, amount_per_unit, unit, sort_order
		) VALUES (
			@id, @catalog_id, @name, @amount_per_unit, @unit, @sort_order
		)
	`);

	const tx = sqlite.transaction(() => {
		for (const item of CATALOG_SUPPLEMENTS) {
			insertCatalog.run({
				id: item.id,
				name: item.name,
				unit: item.unit,
				brand: item.brand,
				info: item.info,
				keywords: item.keywords,
				package_size: null,
				created_at: now,
				updated_at: now
			});

			deleteNutrients.run(item.id);

			for (let i = 0; i < item.nutrients.length; i++) {
				const n = item.nutrients[i];
				insertNutrient.run({
					id: `${item.id}-n-${i}`,
					catalog_id: item.id,
					name: n.name,
					amount_per_unit: n.amountPerUnit,
					unit: n.unit,
					sort_order: i
				});
			}
		}

		sqlite.prepare(`
			INSERT INTO app_meta (key, value) VALUES ('supplement_catalog_version', ?)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value
		`).run(SUPPLEMENT_CATALOG_VERSION);
	});

	tx();
}

export function seedUserDefaultSupplements(userId: string): number {
	if (!userId) return 0;

	// If user already has any supplements, do nothing to respect their current state
	const existingCount = db
		.select({ count: sql<number>`count(*)` })
		.from(supplements)
		.where(eq(supplements.userId, userId))
		.get()?.count ?? 0;

	if (existingCount > 0) return 0;

	const now = Date.now();
	const essentials = CATALOG_SUPPLEMENTS.filter((s) => USER_ESSENTIAL_SUPPLEMENT_IDS.includes(s.id));

	const insertSupp = sqlite.prepare(`
		INSERT INTO supplements (
			id, user_id, name, unit, brand, info, notes, active, stock_quantity, default_amount, sort_order, created_at, updated_at
		) VALUES (
			@id, @user_id, @name, @unit, @brand, @info, @notes, @active, @stock_quantity, @default_amount, @sort_order, @created_at, @updated_at
		)
	`);

	const insertNutrient = sqlite.prepare(`
		INSERT INTO supplement_nutrients (
			id, supplement_id, name, amount_per_unit, unit, sort_order
		) VALUES (
			@id, @supplement_id, @name, @amount_per_unit, @unit, @sort_order
		)
	`);

	const tx = sqlite.transaction(() => {
		for (let i = 0; i < essentials.length; i++) {
			const item = essentials[i];
			const suppId = randomUUID();

			insertSupp.run({
				id: suppId,
				user_id: userId,
				name: item.name,
				unit: item.unit,
				brand: item.brand,
				info: item.info,
				notes: null,
				active: 1,
				stock_quantity: null,
				default_amount: item.defaultAmount,
				sort_order: i,
				created_at: now,
				updated_at: now
			});

			for (let j = 0; j < item.nutrients.length; j++) {
				const n = item.nutrients[j];
				insertNutrient.run({
					id: randomUUID(),
					supplement_id: suppId,
					name: n.name,
					amount_per_unit: n.amountPerUnit,
					unit: n.unit,
					sort_order: j
				});
			}
		}
	});

	tx();
	return essentials.length;
}

export function seedAllEmptyUsersDefaultSupplements(): number {
	const allUsers = db.select({ id: users.id }).from(users).all();
	let totalSeeded = 0;
	for (const u of allUsers) {
		const count = seedUserDefaultSupplements(u.id);
		totalSeeded += count;
	}
	return totalSeeded;
}
