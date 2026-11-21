import { describe, expect, it } from 'vitest';
import { enforceSettingsPolicy, isMaskedApiKey, redactApiKeys } from './settingsPolicy';

describe('settings policy', () => {
	it('masks API keys on the way out and ignores the mask on the way back', () => {
		const out = redactApiKeys({ aiGeminiApiKey: 'AIzaSy-secret-1234', lang: 'en' });
		expect(out).toEqual({ aiGeminiApiKey: '••••••••1234', lang: 'en' });
		expect(isMaskedApiKey(out.aiGeminiApiKey)).toBe(true);

		const patch: Record<string, unknown> = { aiGeminiApiKey: out.aiGeminiApiKey, aiOpenaiApiKey: 'sk-new', unknownKey: 1 };
		expect(enforceSettingsPolicy(patch)).toBeNull();
		expect(patch).toEqual({ aiOpenaiApiKey: 'sk-new' });
	});

	it('rejects values of the wrong type', () => {
		expect(enforceSettingsPolicy({ waterGoalMl: '2000' })).toMatch(/waterGoalMl/);
		expect(enforceSettingsPolicy({ shortcuts: {} })).toMatch(/shortcuts/);
		expect(enforceSettingsPolicy({ waterGoalMl: 2500, theme: 'dark', listCategorySettings: { a: null } })).toBeNull();
	});
});
