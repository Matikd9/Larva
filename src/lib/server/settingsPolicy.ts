import type { UserSettings } from '#lib/userSettingsTypes';

type Kind = 'string' | 'number' | 'boolean' | 'array' | 'object';

// Every setting the app knows, with the JSON type the server accepts for it.
const SETTING_KINDS: Record<keyof UserSettings, Kind> = {
	lang: 'string', timeZone: 'string', theme: 'string', colorScheme: 'string',
	shortcuts: 'array', showRecipes: 'boolean', supplementSortOrder: 'string',
	waterTrackerEnabled: 'boolean', waterGoalMl: 'number', waterPresets: 'array',
	caffeineTrackerEnabled: 'boolean', caffeineLimitMg: 'number', caffeineHiddenDrinks: 'array', caffeineCustomAmounts: 'object',
	meditationTrackerEnabled: 'boolean', meditationDailyGoalMinutes: 'number', meditationDefaultDurationMinutes: 'number',
	meditationPrepSeconds: 'number', meditationStartSound: 'string', meditationEndSound: 'string', meditationVolume: 'number',
	moodTrackerEnabled: 'boolean', moodWeeklyReviewEnabled: 'boolean', dismissedMoodWeeklyReviewWeek: 'string',
	nutritionTrackerEnabled: 'boolean', nutritionMealSubdivisionsEnabled: 'boolean',
	aiNutritionProvider: 'string', aiGeminiApiKey: 'string', aiGeminiModel: 'string', aiOpenaiApiKey: 'string', aiOpenaiModel: 'string',
	hiddenMoodTags: 'array', greetingEnabled: 'boolean', wakeLockRecipes: 'boolean', wakeLockMeditation: 'boolean'
};

const API_KEY_FIELDS = ['aiGeminiApiKey', 'aiOpenaiApiKey', 'aiNutritionApiKey'];
const MASK = '••••••••';

/** Settings leave the server with API keys masked, so keys never reach page HTML, caches or localStorage. */
export function redactApiKeys<T extends object>(settings: T): T {
	const out = { ...settings } as Record<string, unknown>;
	for (const field of API_KEY_FIELDS) {
		const value = out[field];
		if (typeof value === 'string' && value) out[field] = MASK + value.slice(-4);
	}
	return out as T;
}

/** A masked key sent back by a client means "keep the stored key". */
export const isMaskedApiKey = (value: unknown) => typeof value === 'string' && value.startsWith(MASK);

/** Drops unknown keys and masked API keys in place; returns an error for a wrongly typed value. */
export function enforceSettingsPolicy(patch: Record<string, unknown>): string | null {
	for (const [key, value] of Object.entries(patch)) {
		const kind = SETTING_KINDS[key as keyof UserSettings];
		if (!kind || isMaskedApiKey(value)) {
			delete patch[key];
			continue;
		}
		if (value === null) continue;
		const actual = Array.isArray(value) ? 'array' : typeof value;
		if (actual !== kind || (kind === 'number' && !Number.isFinite(value))) return `settings.${key} must be a ${kind}`;
	}
	return null;
}
