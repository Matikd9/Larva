import { describe, expect, it } from 'vitest';
import {
	applyUserSettingsPatch,
	combineUserSettingsPatches,
	hasExplicitUserLanguage,
	sanitizeUserSettingsPatch,
	userSettingsPatchMatches
} from '#lib/userSettingsSync';

describe('user settings patches', () => {
	it('updates top-level settings without replacing unrelated values', () => {
		expect(applyUserSettingsPatch(
			{ theme: 'light', waterGoalMl: 2000 },
			{ theme: 'dark' }
		)).toEqual({ theme: 'dark', waterGoalMl: 2000 });
	});

	it('coalesces repeated offline changes, latest value winning', () => {
		expect(combineUserSettingsPatches(
			{ theme: 'light', waterGoalMl: 2000 },
			{ theme: 'dark', caffeineLimitMg: 300 }
		)).toEqual({ theme: 'dark', waterGoalMl: 2000, caffeineLimitMg: 300 });
	});

	it('detects whether a lost response already applied the queued patch', () => {
		const settings = { theme: 'dark' as const, hiddenMoodTags: ['work'] };
		expect(userSettingsPatchMatches(settings, { theme: 'dark', hiddenMoodTags: ['work'] })).toBe(true);
		expect(userSettingsPatchMatches(settings, { theme: 'light' })).toBe(false);
	});

	it('rejects malformed patch containers', () => {
		expect(sanitizeUserSettingsPatch(null)).toBeNull();
		expect(sanitizeUserSettingsPatch([])).toBeNull();
		expect(sanitizeUserSettingsPatch({ shortcuts: {} })).toBeNull();
	});

	it('turns reactive-style proxies into structured-cloneable settings', () => {
		const hiddenMoodTags = new Proxy(['work', 'sport'], {});
		const settings = new Proxy({ lang: 'en', hiddenMoodTags }, {});
		expect(() => structuredClone(settings)).toThrow();

		const sanitized = sanitizeUserSettingsPatch(settings);
		expect(sanitized).toEqual({ lang: 'en', hiddenMoodTags: ['work', 'sport'] });
		expect(() => structuredClone(sanitized)).not.toThrow();
	});

	it('distinguishes a saved language from the implicit default', () => {
		expect(hasExplicitUserLanguage({})).toBe(false);
		expect(hasExplicitUserLanguage({ lang: 'de' })).toBe(true);
		expect(hasExplicitUserLanguage({ lang: 'en' })).toBe(true);
	});
});
