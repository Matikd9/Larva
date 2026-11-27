import { describe, expect, it, vi } from 'vitest';

vi.mock('#lib/db', () => ({ db: {} }));
vi.mock('./pushNotifications', () => ({ sendPushToUser: vi.fn() }));

const { minutesToCheck } = await import('./reminders');

const at = (hhmmss: string) => new Date(`2026-11-27T${hhmmss}Z`).getTime();

describe('minutesToCheck', () => {
	it('covers exactly the current minute on a punctual tick', () => {
		expect(minutesToCheck(at('08:00:00.020'), at('08:01:00.015'))).toEqual([at('08:01:00')]);
	});

	it('catches up minutes skipped by a late tick, without repeating the last one', () => {
		expect(minutesToCheck(at('08:01:00.010'), at('08:03:20'))).toEqual([at('08:02:00'), at('08:03:00')]);
	});

	it('limits the catch-up after a long outage to the last 15 minutes', () => {
		const minutes = minutesToCheck(at('05:00:00'), at('08:00:30'));
		expect(minutes).toHaveLength(15);
		expect(minutes[0]).toBe(at('07:46:00'));
		expect(minutes.at(-1)).toBe(at('08:00:00'));
	});

	it('checks the current minute on a first start', () => {
		expect(minutesToCheck(null, at('08:00:05'))).toEqual([at('08:00:00')]);
	});
});
