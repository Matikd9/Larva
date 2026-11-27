// Pure History metrics: period comparison and year coverage. No UI, no fetching.
import type { TrackerStats } from './trackerStats';

/** Fewer recorded days than this in either period → no comparison (too little data to compare). */
export const MIN_COMPARE_DAYS = { week: 3, month: 7 } as const;

export type Comparison = { delta: number; currentDays: number; previousDays: number };

export function comparePeriods(current: TrackerStats, previous: TrackerStats, minDays: number): Comparison | null {
	if (current.activeDays < minDays || previous.activeDays < minDays) return null;
	return { delta: current.avgPerDay - previous.avgPerDay, currentDays: current.activeDays, previousDays: previous.activeDays };
}

export type CoverageCategory = 'nutrition' | 'supplements' | 'water' | 'caffeine' | 'meditation' | 'mood';
export type CoverageDay = { registered: number; considered: number; categories: CoverageCategory[] };

/**
 * Per day: how many categories have at least one record, out of the categories that apply that day.
 * Settings keep no history, so a currently enabled category applies from its first record in the
 * range onwards; before that we cannot tell whether the user was tracking it. A disabled category
 * only counts on days it was actually used, so it never lowers coverage.
 */
export function coverageByDay(
	days: string[],
	recordedDays: Partial<Record<CoverageCategory, Set<string>>>,
	enabled: CoverageCategory[]
): Map<string, CoverageDay> {
	const firstRecord = new Map<CoverageCategory, string>();
	for (const [category, set] of Object.entries(recordedDays) as [CoverageCategory, Set<string>][]) {
		let first = '';
		for (const day of set) if (!first || day < first) first = day;
		if (first) firstRecord.set(category, first);
	}
	const result = new Map<string, CoverageDay>();
	for (const day of days) {
		const categories = (Object.keys(recordedDays) as CoverageCategory[]).filter(c => recordedDays[c]?.has(day));
		const considered = new Set(categories);
		for (const category of enabled) {
			const first = firstRecord.get(category);
			if (first && first <= day) considered.add(category);
		}
		result.set(day, { registered: categories.length, considered: considered.size, categories });
	}
	return result;
}

/** 0 = nothing recorded, 1–4 = share of the applicable categories (≤25 %, ≤50 %, ≤75 %, more). */
export function coverageLevel(day: CoverageDay | undefined): 0 | 1 | 2 | 3 | 4 {
	if (!day || day.registered === 0 || day.considered === 0) return 0;
	return Math.min(4, Math.max(1, Math.ceil((day.registered / day.considered) * 4))) as 1 | 2 | 3 | 4;
}

/** Quartile thresholds of the recorded values, so each level holds a similar number of days. */
export function quartiles(values: number[]): [number, number, number] | null {
	const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
	if (sorted.length === 0) return null;
	const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
	return [at(0.25), at(0.5), at(0.75)];
}

export function valueLevel(value: number, q: [number, number, number]): 1 | 2 | 3 | 4 {
	if (value <= q[0]) return 1;
	if (value <= q[1]) return 2;
	if (value <= q[2]) return 3;
	return 4;
}
