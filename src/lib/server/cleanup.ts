import { db } from '#lib/db';
import { barcodeCache, sessions, mealPlanEntries, userInvites } from '#lib/db/schema';
import { and, lt, lte, or, isNotNull, isNull } from 'drizzle-orm';

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

export function cleanupBarcodeCache() {
	db.delete(barcodeCache).where(and(lt(barcodeCache.lastSeenAt, Date.now() - SIX_MONTHS_MS), isNull(barcodeCache.userEditedAt))).run();
}

export function cleanupOldData() {
	const nowS = Math.floor(Date.now() / 1000);
	// Abgelaufene Sessions löschen
	db.delete(sessions).where(lt(sessions.expiresAt, nowS)).run();
	// Wochenplan-Einträge löschen, die älter als 6 Monate sind
	const sixMonthsAgoDate = new Date(Date.now() - SIX_MONTHS_MS);
	const cutoffDate = sixMonthsAgoDate.toISOString().slice(0, 10);
	db.delete(mealPlanEntries).where(lt(mealPlanEntries.date, cutoffDate)).run();
	// Invite-/Reset-Tokens löschen: verbrauchte ODER seit 30 Tagen abgelaufene
	const inviteCutoff = nowS - THIRTY_DAYS_S;
	db.update(userInvites).set({ tokenValue: null }).where(lte(userInvites.expiresAt, nowS)).run();
	db.delete(userInvites).where(or(isNotNull(userInvites.usedAt), lt(userInvites.expiresAt, inviteCutoff))).run();
}
