import { describe, expect, it } from 'vitest';
import { periodRange, shiftPeriod, previousRange, containsToday } from './historyRange';

describe('history ranges', () => {
	it('starts weeks on Monday and covers whole local days', () => {
		const r = periodRange('week', '2026-11-19'); // Thursday
		expect([r.fromKey, r.toKey]).toEqual(['2026-11-16', '2026-11-22']);
		expect(new Date(r.from).getHours()).toBe(0);
		expect(new Date(r.to + 1).getDay()).toBe(1); // next Monday 00:00
	});

	it('uses calendar months and years', () => {
		expect(periodRange('month', '2024-02-10')).toMatchObject({ fromKey: '2024-02-01', toKey: '2024-02-29' });
		expect(periodRange('year', '2026-06-30')).toMatchObject({ fromKey: '2026-01-01', toKey: '2026-12-31' });
	});

	it('keeps a week of seven calendar days across a DST change', () => {
		const tz = process.env.TZ;
		process.env.TZ = 'Europe/Berlin'; // clocks go back on 2026-10-25
		try {
			const r = periodRange('week', '2026-10-25');
			expect([r.fromKey, r.toKey]).toEqual(['2026-10-19', '2026-10-25']);
			expect(r.to - r.from + 1).toBe(7 * 86_400_000 + 3_600_000);
		} finally {
			process.env.TZ = tz;
		}
	});

	it('shifts periods without skipping short months', () => {
		expect(shiftPeriod('month', '2026-01-31', 1)).toBe('2026-02-01');
		expect(shiftPeriod('month', '2026-03-31', -1)).toBe('2026-02-01');
		expect(shiftPeriod('week', '2026-11-19', -1)).toBe('2026-11-12');
		expect(shiftPeriod('year', '2024-02-29', 1)).toBe('2025-01-01');
		expect(previousRange('month', '2026-03-15').fromKey).toBe('2026-02-01');
	});

	it('knows whether a period contains today', () => {
		const now = new Date('2026-11-21T12:00:00');
		expect(containsToday(periodRange('week', '2026-11-21'), now)).toBe(true);
		expect(containsToday(periodRange('week', '2026-11-14'), now)).toBe(false);
	});
});
