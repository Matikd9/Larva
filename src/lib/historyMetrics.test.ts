import { describe, expect, it } from 'vitest';
import { comparePeriods, coverageByDay, coverageLevel, quartiles, valueLevel } from './historyMetrics';
import type { TrackerStats } from './trackerStats';

const stats = (avgPerDay: number, activeDays: number) => ({ avgPerDay, activeDays }) as TrackerStats;

describe('comparePeriods', () => {
	it('compares averages and reports the coverage of both periods', () => {
		expect(comparePeriods(stats(1800, 5), stats(2000, 6), 3)).toEqual({ delta: -200, currentDays: 5, previousDays: 6 });
	});
	it('refuses when either period has too few recorded days', () => {
		expect(comparePeriods(stats(1800, 2), stats(2000, 6), 3)).toBeNull();
		expect(comparePeriods(stats(1800, 5), stats(2000, 1), 3)).toBeNull();
	});
});

describe('coverageByDay', () => {
	const days = ['2026-01-01', '2026-01-02', '2026-01-03'];
	it('counts each category once per day, not each record', () => {
		const coverage = coverageByDay(days, { water: new Set(['2026-01-01']), nutrition: new Set(['2026-01-01']) }, ['water', 'nutrition']);
		expect(coverage.get('2026-01-01')).toMatchObject({ registered: 2, considered: 2 });
	});
	it('applies an enabled category only from its first record onwards', () => {
		const coverage = coverageByDay(days, { water: new Set(['2026-01-01', '2026-01-03']), mood: new Set(['2026-01-02']) }, ['water', 'mood', 'meditation']);
		expect(coverage.get('2026-01-01')).toMatchObject({ registered: 1, considered: 1 }); // mood not started, meditation never used
		expect(coverage.get('2026-01-03')).toMatchObject({ registered: 1, considered: 2 }); // mood started on the 2nd
	});
	it('lets a disabled category count only on the days it was used', () => {
		const coverage = coverageByDay(days, { water: new Set(days), caffeine: new Set(['2026-01-02']) }, ['water']);
		expect(coverage.get('2026-01-02')).toMatchObject({ registered: 2, considered: 2 });
		expect(coverage.get('2026-01-03')).toMatchObject({ registered: 1, considered: 1 });
	});
});

describe('levels', () => {
	it('separates "nothing recorded" from low coverage', () => {
		expect(coverageLevel({ registered: 0, considered: 4, categories: [] })).toBe(0);
		expect(coverageLevel({ registered: 1, considered: 5, categories: ['water'] })).toBe(1);
		expect(coverageLevel({ registered: 4, considered: 4, categories: [] })).toBe(4);
	});
	it('splits values into quartiles', () => {
		const q = quartiles([100, 200, 300, 400, 500, 600, 700, 800])!;
		expect(q).toEqual([300, 500, 700]);
		expect([valueLevel(100, q), valueLevel(450, q), valueLevel(700, q), valueLevel(900, q)]).toEqual([1, 2, 3, 4]);
		expect(quartiles([])).toBeNull();
	});
});
