import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { lookupProduct, type ProductData } from '#lib/server/nutrition';
import { db } from '#lib/db';
import { barcodeCache } from '#lib/db/schema';
import { eq } from 'drizzle-orm';
import { type EssentialMicros, parseMicrosJson, stringifyMicrosJson } from '#lib/micronutrients';

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const code = event.params.barcode;
	const product = await lookupProduct(code);
	if (!product) return Response.json({ product: null });
	return Response.json({ product });
};

export const PATCH: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const code = event.params.barcode;
	let body: {
		name?: string;
		brand?: string | null;
		servingQuantity?: number | null;
		servingSize?: string | null;
		kcalPer100?: number | null;
		proteinPer100?: number | null;
		fatPer100?: number | null;
		carbsPer100?: number | null;
		sugarPer100?: number | null;
		fiberPer100?: number | null;
		saltPer100?: number | null;
		micros?: EssentialMicros | null;
		ingredientsText?: string | null;
	} | null = null;

	try {
		body = await event.request.json();
	} catch {
		return Response.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (!body) return Response.json({ error: 'Empty body' }, { status: 400 });

	const num = (v: unknown): number | null => {
		if (typeof v === 'number' && Number.isFinite(v)) return v;
		if (typeof v === 'string') {
			const n = parseFloat(v.replace(',', '.'));
			return Number.isFinite(n) ? n : null;
		}
		return null;
	};

	const servingQuantity = body.servingQuantity !== undefined ? num(body.servingQuantity) : undefined;
	const servingSize =
		body.servingSize !== undefined
			? typeof body.servingSize === 'string' && body.servingSize.trim()
				? body.servingSize.trim()
				: servingQuantity
					? `${servingQuantity} g`
					: null
			: servingQuantity
				? `${servingQuantity} g`
				: undefined;

	const kcalPer100 = body.kcalPer100 !== undefined ? num(body.kcalPer100) : undefined;
	const proteinPer100 = body.proteinPer100 !== undefined ? num(body.proteinPer100) : undefined;
	const fatPer100 = body.fatPer100 !== undefined ? num(body.fatPer100) : undefined;
	const carbsPer100 = body.carbsPer100 !== undefined ? num(body.carbsPer100) : undefined;
	const sugarPer100 = body.sugarPer100 !== undefined ? num(body.sugarPer100) : undefined;
	const fiberPer100 = body.fiberPer100 !== undefined ? num(body.fiberPer100) : undefined;
	const saltPer100 = body.saltPer100 !== undefined ? num(body.saltPer100) : undefined;
	const microsJson = body.micros !== undefined ? stringifyMicrosJson(body.micros) : undefined;
	const ingredientsText = body.ingredientsText !== undefined ? (typeof body.ingredientsText === 'string' ? body.ingredientsText.trim() || null : null) : undefined;
	const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined;
	const brand = body.brand !== undefined ? (typeof body.brand === 'string' ? body.brand.trim() || null : null) : undefined;

	const now = Date.now();
	const existing = db.select().from(barcodeCache).where(eq(barcodeCache.barcode, code)).get();

	if (existing) {
		db.update(barcodeCache)
			.set({
				...(name !== undefined ? { name } : {}),
				...(brand !== undefined ? { brand } : {}),
				...(servingQuantity !== undefined ? { servingQuantity } : {}),
				...(servingSize !== undefined ? { servingSize } : {}),
				...(kcalPer100 !== undefined ? { kcalPer100 } : {}),
				...(proteinPer100 !== undefined ? { proteinPer100 } : {}),
				...(fatPer100 !== undefined ? { fatPer100 } : {}),
				...(carbsPer100 !== undefined ? { carbsPer100 } : {}),
				...(sugarPer100 !== undefined ? { sugarPer100 } : {}),
				...(fiberPer100 !== undefined ? { fiberPer100 } : {}),
				...(saltPer100 !== undefined ? { saltPer100 } : {}),
				...(microsJson !== undefined ? { microsJson } : {}),
				...(ingredientsText !== undefined ? { ingredientsText } : {}),
				userEditedAt: now,
				lastSeenAt: now
			})
			.where(eq(barcodeCache.barcode, code))
			.run();
	} else {
		db.insert(barcodeCache)
			.values({
				barcode: code,
				name: name || `Producto ${code}`,
				brand: brand ?? null,
				servingQuantity: servingQuantity ?? null,
				servingSize: servingSize ?? (servingQuantity ? `${servingQuantity} g` : null),
				kcalPer100: kcalPer100 ?? null,
				proteinPer100: proteinPer100 ?? null,
				fatPer100: fatPer100 ?? null,
				carbsPer100: carbsPer100 ?? null,
				sugarPer100: sugarPer100 ?? null,
				fiberPer100: fiberPer100 ?? null,
				saltPer100: saltPer100 ?? null,
				microsJson: microsJson ?? null,
				ingredientsText: ingredientsText ?? null,
				userEditedAt: now,
				lastSeenAt: now,
				fetchedAt: now
			})
			.run();
	}

	const updated = db.select().from(barcodeCache).where(eq(barcodeCache.barcode, code)).get();
	const product: ProductData | null = updated
		? {
				barcode: updated.barcode,
				name: updated.name,
				brand: updated.brand,
				imageUrl: updated.imageUrl,
				servingSize: updated.servingSize,
				servingQuantity: updated.servingQuantity,
				nutriscoreGrade: updated.nutriscoreGrade,
				novaGroup: updated.novaGroup,
				kcalPer100: updated.kcalPer100,
				proteinPer100: updated.proteinPer100,
				fatPer100: updated.fatPer100,
				carbsPer100: updated.carbsPer100,
				sugarPer100: updated.sugarPer100,
				fiberPer100: updated.fiberPer100,
				saltPer100: updated.saltPer100,
				micros: parseMicrosJson(updated.microsJson),
				ingredientsText: updated.ingredientsText ?? null
			}
		: null;

	return Response.json({ ok: true, product });
};
