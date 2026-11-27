import type { Locale } from '#lib/paraglide/runtime';

export type ShortcutAction = 'log-meal' | 'log-supplement' | 'log-water' | 'log-caffeine' | 'log-mood' | 'log-meditation' | 'log-tracker';

export type Shortcut = {
	id: string;
	name: string;
	action: ShortcutAction;
};

export type UserSettings = {
	lang?: Locale;
	timeZone?: string;
	theme?: 'system' | 'light' | 'dark';
	colorScheme?: 'crimson' | 'forest' | 'classic' | 'indigo';
	shortcuts?: Shortcut[];
	showRecipes?: boolean;
	supplementSortOrder?: 'az' | 'za' | 'freq';
	waterTrackerEnabled?: boolean;
	waterGoalMl?: number;
	waterPresets?: [number, number];
	caffeineTrackerEnabled?: boolean;
	caffeineLimitMg?: number;
	caffeineHiddenDrinks?: string[];
	caffeineCustomAmounts?: Record<string, number>;
	meditationTrackerEnabled?: boolean;
	meditationDailyGoalMinutes?: number;
	meditationDefaultDurationMinutes?: number;
	meditationPrepSeconds?: number;
	meditationStartSound?: string;
	meditationEndSound?: string;
	meditationVolume?: number;
	moodTrackerEnabled?: boolean;
	moodWeeklyReviewEnabled?: boolean;
	dismissedMoodWeeklyReviewWeek?: string;
	nutritionTrackerEnabled?: boolean;
	nutritionMealSubdivisionsEnabled?: boolean;
	aiNutritionProvider?: 'gemini' | 'openai';
	aiGeminiApiKey?: string;
	aiGeminiModel?: 'gemini-flash-lite-latest' | 'gemini-flash-latest' | 'gemini-3.5-flash-lite' | 'gemini-3.5-flash' | 'gemini-2.5-flash' | string;
	aiOpenaiApiKey?: string;
	aiOpenaiModel?: 'gpt-4o-mini' | 'gpt-4o';
	hiddenMoodTags?: string[];
	greetingEnabled?: boolean;
	wakeLockRecipes?: boolean;
	wakeLockMeditation?: boolean;
};

export const DEFAULT_SETTINGS = {
	lang: 'en' as Locale
};
