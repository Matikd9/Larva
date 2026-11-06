
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { searchOff, searchLocalCache, type ProductData } from '#lib/server/nutrition';
import { db } from '#lib/db';
import { genericFoods } from '#lib/db/schema';
import { sql, or, like } from 'drizzle-orm';
import { type EssentialMicros, parseMicrosJson } from '#lib/micronutrients';

type GenericCounterpart = {
	id: string;
	name: string;
	cookingState: 'raw' | 'cooked';
	kcalPer100: number;
	proteinPer100: number | null;
	fatPer100: number | null;
	carbsPer100: number | null;
	sugarPer100: number | null;
	fiberPer100: number | null;
	saltPer100: number | null;
	defaultPieceWeight: number | null;
	defaultUnit: 'g' | 'ml' | 'piece';
	micros?: EssentialMicros | null;
};

type GenericResult = {
	type: 'generic';
	id: string;
	category: string;
	name: string;
	cookingState?: 'raw' | 'cooked' | null;
	counterpartId?: string | null;
	counterpart?: GenericCounterpart | null;
	kcalPer100: number;
	proteinPer100: number | null;
	fatPer100: number | null;
	carbsPer100: number | null;
	sugarPer100: number | null;
	fiberPer100: number | null;
	saltPer100: number | null;
	defaultPieceWeight: number | null;
	defaultUnit: 'g' | 'ml' | 'piece';
	micros?: EssentialMicros | null;
};

type ProductResult = {
	type: 'product';
	barcode: string;
	name: string;
	brand: string | null;
	imageUrl: string | null;
	nutriscoreGrade: string | null;
	servingQuantity: number | null;
	servingSize?: string | null;
	kcalPer100: number | null;
	proteinPer100: number | null;
	fatPer100: number | null;
	carbsPer100: number | null;
	sugarPer100: number | null;
	fiberPer100: number | null;
	saltPer100: number | null;
	micros?: EssentialMicros | null;
};

function stripAccents(str: string): string {
	return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getLocalizedName(
	r: { nameEs?: string | null; nameDe: string; nameEn: string },
	lang: 'es' | 'en' | 'de'
): string {
	if (lang === 'es' && r.nameEs) return r.nameEs;
	if (lang === 'de') return r.nameDe;
	return r.nameEn || r.nameEs || r.nameDe;
}

function searchGenerics(query: string, lang: 'es' | 'de' | 'en'): GenericResult[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const qNorm = stripAccents(q);
	const pattern = `%${q}%`;
	const patternNorm = `%${qNorm}%`;

	const patterns = qNorm !== q ? [pattern, patternNorm] : [pattern];
	const conditions = [];
	for (const p of patterns) {
		conditions.push(
			like(sql`lower(coalesce(${genericFoods.nameEs}, ''))`, p),
			like(sql`lower(${genericFoods.nameEn})`, p),
			like(sql`lower(${genericFoods.nameDe})`, p),
			like(sql`lower(coalesce(${genericFoods.keywordsEs}, ''))`, p),
			like(sql`lower(coalesce(${genericFoods.keywordsEn}, ''))`, p),
			like(sql`lower(coalesce(${genericFoods.keywordsDe}, ''))`, p)
		);
	}

	// Große Auswahl matchen (limit 80)
	const rows = db
		.select()
		.from(genericFoods)
		.where(or(...conditions))
		.limit(80)
		.all();

	function score(r: (typeof rows)[number]): number {
		const targetName = getLocalizedName(r, lang).toLowerCase();
		const altName1 = (lang === 'es' ? r.nameEn : r.nameEs ?? '').toLowerCase();
		const altName2 = (lang === 'de' ? r.nameEn : r.nameDe).toLowerCase();

		const targetNameNorm = stripAccents(targetName);
		const altName1Norm = stripAccents(altName1);
		const altName2Norm = stripAccents(altName2);

		const kwTarget = (lang === 'es' ? r.keywordsEs : lang === 'de' ? r.keywordsDe : r.keywordsEn) ?? '';
		const kwOther = `${r.keywordsEs ?? ''},${r.keywordsEn ?? ''},${r.keywordsDe ?? ''}`;
		const kwTargetNorm = stripAccents(kwTarget.toLowerCase());
		const kwOtherNorm = stripAccents(kwOther.toLowerCase());

		if (targetName === q || targetNameNorm === qNorm) return 0;
		if (altName1 === q || altName1Norm === qNorm || altName2 === q || altName2Norm === qNorm) return 1;
		if (targetName.startsWith(q) || targetNameNorm.startsWith(qNorm)) return 2;
		if (altName1.startsWith(q) || altName1Norm.startsWith(qNorm) || altName2.startsWith(q) || altName2Norm.startsWith(qNorm)) return 3;

		const targetKwWords = kwTargetNorm.split(/[,\s]+/).filter(Boolean);
		if (targetKwWords.some((w) => w.startsWith(qNorm))) return 4;

		if (targetName.includes(q) || targetNameNorm.includes(qNorm)) return 5;

		const otherKwWords = kwOtherNorm.split(/[,\s]+/).filter(Boolean);
		if (otherKwWords.some((w) => w.startsWith(qNorm))) return 6;
		if (targetKwWords.some((w) => w.includes(qNorm))) return 7;

		return 8;
	}

	const topRows = rows
		.map((r) => ({ r, s: score(r) }))
		.sort((a, b) => a.s - b.s || a.r.nameDe.length - b.r.nameDe.length)
		.slice(0, 15)
		.map(({ r }) => r);

	// Gegenstücke (Cooked / Raw) für schnelle 1-Klick-Umschaltung laden
	const counterpartIds = topRows
		.map((r) => r.counterpartId)
		.filter((id): id is string => Boolean(id));

	const counterpartMap = new Map<string, GenericCounterpart>();
	if (counterpartIds.length > 0) {
		const cpRows = db
			.select()
			.from(genericFoods)
			.where(
				or(...counterpartIds.map((cid) => sql`${genericFoods.id} = ${cid}`))
			)
			.all();

		for (const cp of cpRows) {
			counterpartMap.set(cp.id, {
				id: cp.id,
				name: getLocalizedName(cp, lang),
				cookingState: (cp.cookingState as 'raw' | 'cooked') ?? 'raw',
				kcalPer100: cp.kcalPer100,
				proteinPer100: cp.proteinPer100,
				fatPer100: cp.fatPer100,
				carbsPer100: cp.carbsPer100,
				sugarPer100: cp.sugarPer100,
				fiberPer100: cp.fiberPer100,
				saltPer100: cp.saltPer100,
				defaultPieceWeight: cp.defaultPieceWeight,
				defaultUnit: (cp.defaultUnit as 'g' | 'ml' | 'piece') ?? 'g',
				micros: parseMicrosJson(cp.microsJson)
			});
		}
	}

	return topRows.map((r) => ({
		type: 'generic' as const,
		id: r.id,
		category: r.category,
		name: getLocalizedName(r, lang),
		cookingState: (r.cookingState as 'raw' | 'cooked') ?? null,
		counterpartId: r.counterpartId ?? null,
		counterpart: r.counterpartId ? counterpartMap.get(r.counterpartId) ?? null : null,
		kcalPer100: r.kcalPer100,
		proteinPer100: r.proteinPer100,
		fatPer100: r.fatPer100,
		carbsPer100: r.carbsPer100,
		sugarPer100: r.sugarPer100,
		fiberPer100: r.fiberPer100,
		saltPer100: r.saltPer100,
		defaultPieceWeight: r.defaultPieceWeight,
		defaultUnit: (r.defaultUnit as 'g' | 'ml' | 'piece') ?? 'g',
		micros: parseMicrosJson(r.microsJson)
	}));
}

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const q = event.url.searchParams.get('q')?.trim() ?? '';
	const rawLang = event.url.searchParams.get('lang')?.toLowerCase() ?? 'es';
	const lang: 'es' | 'en' | 'de' = rawLang.startsWith('de') ? 'de' : rawLang.startsWith('en') ? 'en' : 'es';
	// source: 'local' = nur Generics + Cache (schnell), 'off' = nur Online-Produkte (langsam),
	// fehlt = beides kombiniert (Rückwärtskompatibilität, z.B. Generic-Lookup per id).
	const source = event.url.searchParams.get('source');
	if (!q) return Response.json({ generic: [], products: [] });

	const looksLikeBarcode = /^\d{8,14}$/.test(q);

	const mapProduct = (p: ProductData): ProductResult => ({
		type: 'product' as const,
		barcode: p.barcode,
		name: p.name,
		brand: p.brand,
		imageUrl: p.imageUrl,
		nutriscoreGrade: p.nutriscoreGrade,
		servingQuantity: p.servingQuantity,
		servingSize: p.servingSize,
		kcalPer100: p.kcalPer100,
		proteinPer100: p.proteinPer100,
		fatPer100: p.fatPer100,
		carbsPer100: p.carbsPer100,
		sugarPer100: p.sugarPer100,
		fiberPer100: p.fiberPer100,
		saltPer100: p.saltPer100,
		micros: p.micros ?? null
	});

	// Stufe „off" — nur die langsame Online-Suche.
	if (source === 'off') {
		if (looksLikeBarcode) return Response.json({ products: [] });
		const off = await searchOff(q, 15, event.request.signal);
		return Response.json({ products: off.map(mapProduct) });
	}

	// Stufe „local" — Generics + lokaler Cache, ohne Netzwerk.
	const generic = searchGenerics(q, lang);
	if (source === 'local') {
		const local = looksLikeBarcode ? [] : searchLocalCache(q, 15);
		return Response.json({ generic, products: local.map(mapProduct), looksLikeBarcode });
	}

	// Default: beides kombiniert (lokal hat Vorrang, OFF füllt auf).
	let products: ProductResult[] = [];
	if (!looksLikeBarcode) {
		const local = searchLocalCache(q, 15);
		const off = await searchOff(q, 12, event.request.signal);
		const seen = new Set<string>();
		const combined: ProductData[] = [];
		for (const p of [...local, ...off]) {
			if (seen.has(p.barcode)) continue;
			seen.add(p.barcode);
			combined.push(p);
		}
		products = combined.slice(0, 20).map(mapProduct);
	}

	return Response.json({ generic, products, looksLikeBarcode });
};
