import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { supplementLogs, supplements, supplementNutrients } from '#lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { zipSync, strToU8 } from 'fflate';
import { resolveTimeZone, zonedDateTimeToTimestamp } from '#lib/timeZones';
import { csvCell } from '#lib/server/csv';

const BOM = '﻿';

function formatLocalDatetime(ts: number, tz: string): string {
	try {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: tz,
			year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit', second: '2-digit',
			hour12: false
		}).formatToParts(new Date(ts));
		const p: Record<string, string> = {};
		for (const part of parts) p[part.type] = part.value;
		return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
	} catch {
		return new Date(ts).toISOString().slice(0, 19);
	}
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const wantLogs = event.url.searchParams.get('logs') === '1';
	const wantCatalog = event.url.searchParams.get('catalog') === '1';
	const tz = resolveTimeZone(event.url.searchParams.get('tz'), 'UTC');
	const fromDate = event.url.searchParams.get('fromDate');
	const toDate = event.url.searchParams.get('toDate');
	const isDateKey = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

	// Day boundaries in the user's zone, not the server's.
	const fromTs = isDateKey(fromDate) ? zonedDateTimeToTimestamp(fromDate, '00:00', tz) : null;
	const toTs = isDateKey(toDate) ? zonedDateTimeToTimestamp(toDate, '23:59', tz) + 59_999 : null;

	if (!wantLogs && !wantCatalog) {
		return new Response('No export type selected', { status: 400 });
	}

	const userSupplements = db
		.select()
		.from(supplements)
		.where(eq(supplements.userId, user!.id))
		.all();

	const suppById = new Map(userSupplements.map(s => [s.id, s]));

	let logsCsv: string | null = null;
	let catalogCsv: string | null = null;

	if (wantLogs) {
		const conditions = [eq(supplementLogs.userId, user!.id)];
		if (fromTs) conditions.push(gte(supplementLogs.loggedAt, fromTs));
		if (toTs) conditions.push(lte(supplementLogs.loggedAt, toTs));
		const logs = db
			.select()
			.from(supplementLogs)
			.where(and(...conditions))
			.orderBy(supplementLogs.loggedAt)
			.all();

		const rows = logs.map(log => {
			const datetime = formatLocalDatetime(log.loggedAt, tz);
			const sup = suppById.get(log.supplementId);
			const name = sup ? sup.name : log.supplementId;
			const brand = sup?.brand ?? '';
			const unit = sup?.unit ?? '';
			const note = log.note ?? '';
			return [datetime, csvCell(name), csvCell(brand), log.amount, csvCell(unit), csvCell(note)].join(',');
		});

		logsCsv = BOM + 'datetime,supplement,brand,amount,unit,log_note\n' + rows.join('\n') + '\n';
	}

	if (wantCatalog) {
		const nutrients = db
			.select()
			.from(supplementNutrients)
			.all()
			.filter(n => suppById.has(n.supplementId));

		const nutrientsBySuppId = new Map<string, typeof nutrients>();
		for (const n of nutrients) {
			if (!nutrientsBySuppId.has(n.supplementId)) nutrientsBySuppId.set(n.supplementId, []);
			nutrientsBySuppId.get(n.supplementId)!.push(n);
		}

		const rows: string[] = [];
		for (const sup of userSupplements) {
			const suppNutrients = nutrientsBySuppId.get(sup.id) ?? [];
			if (suppNutrients.length === 0) {
				rows.push([
					csvCell(sup.name),
					csvCell(sup.brand ?? ''),
					csvCell(sup.unit),
					sup.defaultAmount,
					'', '', ''
				].join(','));
			} else {
				for (const n of suppNutrients) {
					rows.push([
						csvCell(sup.name),
						csvCell(sup.brand ?? ''),
						csvCell(sup.unit),
						sup.defaultAmount,
						csvCell(n.name),
						n.amountPerUnit,
						csvCell(n.unit)
					].join(','));
				}
			}
		}

		catalogCsv = BOM + 'supplement,brand,unit,default_amount,nutrient,nutrient_amount,nutrient_unit\n' + rows.join('\n') + '\n';
	}

	// Both selected → ZIP
	if (logsCsv && catalogCsv) {
		const zip = zipSync({
			'supplement-logs.csv': strToU8(logsCsv),
			'supplement-catalog.csv': strToU8(catalogCsv)
		});
		return new Response(zip.buffer as BodyInit, {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': 'attachment; filename="groly-supplements.zip"'
			}
		});
	}

	// Single export
	const csv = logsCsv ?? catalogCsv!;
	const filename = logsCsv ? 'supplement-logs.csv' : 'supplement-catalog.csv';
	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
