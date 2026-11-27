// Calendar ranges for History. Built from local calendar days (setDate), never from
// fixed 24 h steps, so days with a DST change keep their real 23/25 hours.
import { toLocalDateKey } from './dates';

export type HistoryPeriod = 'week' | 'month' | 'year';
export type PeriodRange = { from: number; to: number; fromKey: string; toKey: string };

function atMidnight(key: string): Date {
	return new Date(`${key}T00:00:00`);
}

function rangeOf(start: Date, endExclusive: Date): PeriodRange {
	const last = new Date(endExclusive);
	last.setDate(last.getDate() - 1);
	return { from: start.getTime(), to: endExclusive.getTime() - 1, fromKey: toLocalDateKey(start), toKey: toLocalDateKey(last) };
}

export function periodRange(period: HistoryPeriod, dateKey: string): PeriodRange {
	const d = atMidnight(dateKey);
	if (period === 'week') {
		const start = new Date(d);
		start.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
		const end = new Date(start);
		end.setDate(start.getDate() + 7);
		return rangeOf(start, end);
	}
	if (period === 'month') return rangeOf(new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1));
	return rangeOf(new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear() + 1, 0, 1));
}

/** Date key inside the neighbouring period (dir = -1 previous, +1 next). */
export function shiftPeriod(period: HistoryPeriod, dateKey: string, dir: -1 | 1): string {
	const d = atMidnight(dateKey);
	if (period === 'week') {
		d.setDate(d.getDate() + dir * 7);
	} else if (period === 'month') {
		d.setDate(1); // day 31 would overflow into the following month
		d.setMonth(d.getMonth() + dir);
	} else {
		d.setFullYear(d.getFullYear() + dir, 0, 1);
	}
	return toLocalDateKey(d);
}

export function previousRange(period: HistoryPeriod, dateKey: string): PeriodRange {
	return periodRange(period, shiftPeriod(period, dateKey, -1));
}

export function containsToday(range: PeriodRange, now = new Date()): boolean {
	const today = toLocalDateKey(now);
	return range.fromKey <= today && today <= range.toKey;
}
