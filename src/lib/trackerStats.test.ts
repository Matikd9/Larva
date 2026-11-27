import { describe, expect, it } from 'vitest';
import { computeAdherence, computeTrackerStats } from './trackerStats';
import { periodRange } from './historyRange';

const at = (key: string, hour = 9) => new Date(`${key}T${String(hour).padStart(2, '0')}:00:00`).getTime();
const week = periodRange('week', '2026-11-16'); // Mon 16 – Sun 22
const thursday = new Date('2026-11-19T20:00:00');

describe('computeTrackerStats', () => {
	it('averages over recorded days and only counts days up to today', () => {
		const stats = computeTrackerStats([
			{ value: 100, loggedAt: at('2026-11-16') },
			{ value: 200, loggedAt: at('2026-11-16', 15) },
			{ value: 300, loggedAt: at('2026-11-18') }
		], week, thursday);
		expect(stats).toMatchObject({ total: 600, activeDays: 2, avgPerDay: 300, totalDays: 7, countableDays: 4, min: 300, max: 300 });
		expect(stats.logCounts).toEqual([2, 0, 1, 0, 0, 0, 0]);
	});

	it('treats a recorded zero as a record, not as a missing day', () => {
		const stats = computeTrackerStats([{ value: 0, loggedAt: at('2026-11-17') }], week, thursday);
		expect(stats.activeDays).toBe(1);
		expect(stats.logCounts[1]).toBe(1);
	});

	it('accepts date-keyed rows such as daily meal totals', () => {
		const stats = computeTrackerStats([{ value: 1800, date: '2026-11-20' }], week, new Date('2026-11-22T12:00:00'));
		expect(stats.daily[4]).toBe(1800);
		expect(stats.countableDays).toBe(7);
	});
});

describe('computeAdherence', () => {
	const daily = (days: number[]) => JSON.stringify(days);
	it('ignores days before the supplement existed and days in the future', () => {
		const [result] = computeAdherence(
			[{ id: 's', name: 'D3', unit: 'cap', createdAt: at('2026-11-18', 8) }],
			[{ supplementId: 's', days: daily([0, 1, 2, 3, 4, 5, 6]), time: '08:00', active: true }],
			[{ supplementId: 's', amount: 1, loggedAt: at('2026-11-18') }],
			week,
			thursday
		);
		expect(result.daily).toEqual(['out', 'out', 'full', 'none', 'out', 'out', 'out']);
		expect([result.taken, result.planned, result.percent, result.countableDays]).toEqual([1, 2, 50, 2]);
	});

	it('keeps logs that predate createdAt instead of hiding them', () => {
		const [result] = computeAdherence(
			[{ id: 's', name: 'D3', unit: 'cap', createdAt: at('2026-11-19') }],
			[],
			[{ supplementId: 's', amount: 1, loggedAt: at('2026-11-17') }],
			week,
			thursday
		);
		expect(result.daily.slice(0, 4)).toEqual(['out', 'full', 'out', 'unscheduled']);
		expect([result.taken, result.countableDays, result.percent]).toEqual([1, 2, 50]);
	});
});
