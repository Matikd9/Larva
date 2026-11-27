import { normalizeShortcuts, MAX_SHORTCUTS } from '#lib/shortcutActions';
import { browser } from '$app/env';
import { type UserSettings, type Shortcut, DEFAULT_SETTINGS } from '#lib/userSettingsTypes';
export type { UserSettings, Shortcut } from '#lib/userSettingsTypes';
export { DEFAULT_SETTINGS } from '#lib/userSettingsTypes';
import type { Locale } from '#lib/paraglide/runtime';
import { drainPendingMutations, queueUserSettingsPatch, refreshUserSettings } from '#lib/sync/manager';
import type { UserSettingsPatch } from '#lib/userSettingsSync';

const CACHE_KEY = 'groly_settings';
const CACHE_OWNER_KEY = 'groly_settings_owner';

function scopedCacheKey(userId: string) {
	return `${CACHE_KEY}:${userId}`;
}

function parseCache(raw: string | null): UserSettings | null {
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

function loadCache(userId?: string | null): UserSettings {
	if (!browser) return {};
	try {
		if (userId) {
			const scoped = parseCache(localStorage.getItem(scopedCacheKey(userId)));
			if (scoped) return scoped;
			const legacyOwner = localStorage.getItem(CACHE_OWNER_KEY);
			const legacy = !legacyOwner || legacyOwner === userId
				? parseCache(localStorage.getItem(CACHE_KEY))
				: null;
			if (legacy) {
				localStorage.setItem(CACHE_OWNER_KEY, userId);
				localStorage.setItem(scopedCacheKey(userId), JSON.stringify(legacy));
				return legacy;
			}
			return {};
		}
		const raw = localStorage.getItem(CACHE_KEY);
		// Legacy: migrate old separate keys
		if (!raw) {
			const legacyLang = localStorage.getItem('groly_lang');
			return legacyLang ? { lang: legacyLang as Locale } : {};
		}
		return JSON.parse(raw);
	} catch { return {}; }
}

function saveCache(s: UserSettings, userId: string | null = activeSettingsUserId) {
	if (!browser) return;
	if (userId) {
		localStorage.setItem(scopedCacheKey(userId), JSON.stringify(s));
		localStorage.setItem(CACHE_OWNER_KEY, userId);
	}
	// Keep the legacy key current during the service-worker rollout. New code only
	// reads it for its recorded owner, so a later account cannot inherit it.
	localStorage.setItem(CACHE_KEY, JSON.stringify(s));
}

// --- Reactive state ---
// The user ID is only known from the root layout. Start neutral to avoid showing
// another account's legacy cache for even a frame; initUserSettings applies the
// correct scoped cache synchronously before its first network await.
const cache: UserSettings = {};

let _lang = $state(cache.lang ?? DEFAULT_SETTINGS.lang);
let _timeZone = $state<string>(cache.timeZone ?? '');
let _shortcuts = $state<Shortcut[]>(cache.shortcuts ?? []);
let _showRecipes = $state<boolean>(cache.showRecipes ?? true);
let _theme = $state<'system' | 'light' | 'dark'>(cache.theme ?? 'system');
let _colorScheme = $state<'crimson' | 'forest' | 'classic' | 'indigo'>(cache.colorScheme ?? 'crimson');
let _supplementSortOrder = $state<'az' | 'za' | 'freq'>(cache.supplementSortOrder ?? 'az');
let _waterTrackerEnabled = $state<boolean>(cache.waterTrackerEnabled ?? true);
let _waterGoalMl = $state<number>(cache.waterGoalMl ?? 2000);
let _waterPresets = $state<[number, number]>(cache.waterPresets ?? [100, 200]);
let _caffeineTrackerEnabled = $state<boolean>(cache.caffeineTrackerEnabled ?? true);
let _caffeineLimitMg = $state<number>(cache.caffeineLimitMg ?? 400);
let _caffeineHiddenDrinks = $state<string[]>(cache.caffeineHiddenDrinks ?? []);
let _caffeineCustomAmounts = $state<Record<string, number>>(cache.caffeineCustomAmounts ?? {});
let _meditationTrackerEnabled = $state<boolean>(cache.meditationTrackerEnabled ?? true);
let _meditationDailyGoalMinutes = $state<number>(cache.meditationDailyGoalMinutes ?? 15);
let _meditationDefaultDurationMinutes = $state<number>(cache.meditationDefaultDurationMinutes ?? 10);
let _meditationPrepSeconds = $state<number>(cache.meditationPrepSeconds ?? 20);
let _meditationStartSound = $state<string>(cache.meditationStartSound ?? 'zen-tone-mid.mp3');
let _meditationEndSound = $state<string>(cache.meditationEndSound ?? 'auk-zen-gong.mp3');
let _meditationVolume = $state<number>(cache.meditationVolume ?? 70);
let _moodTrackerEnabled = $state<boolean>(cache.moodTrackerEnabled ?? true);
let _moodWeeklyReviewEnabled = $state<boolean>(cache.moodWeeklyReviewEnabled ?? true);
let _dismissedMoodWeeklyReviewWeek = $state<string>(cache.dismissedMoodWeeklyReviewWeek ?? '');
let _nutritionTrackerEnabled = $state<boolean>(cache.nutritionTrackerEnabled ?? true);
let _nutritionMealSubdivisionsEnabled = $state<boolean>(cache.nutritionMealSubdivisionsEnabled ?? true);
let _aiNutritionProvider = $state<'gemini' | 'openai'>(cache.aiNutritionProvider ?? 'gemini');
let _aiGeminiApiKey = $state<string>(cache.aiGeminiApiKey ?? '');
const _cachedGeminiModel = cache.aiGeminiModel;
const _deprecatedGemini = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite'];
let _aiGeminiModel = $state<string>(
	_cachedGeminiModel && !_deprecatedGemini.includes(_cachedGeminiModel)
		? _cachedGeminiModel
		: 'gemini-flash-lite-latest'
);
let _aiOpenaiApiKey = $state<string>(cache.aiOpenaiApiKey ?? '');
let _aiOpenaiModel = $state<'gpt-4o-mini' | 'gpt-4o'>(cache.aiOpenaiModel ?? 'gpt-4o-mini');
let _hiddenMoodTags = $state<string[]>(cache.hiddenMoodTags ?? []);
let _greetingEnabled = $state<boolean>(cache.greetingEnabled ?? true);
let _wakeLockRecipes = $state<boolean>(cache.wakeLockRecipes ?? true);
let _wakeLockMeditation = $state<boolean>(cache.wakeLockMeditation ?? true);

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _persistPromise: Promise<void> = Promise.resolve();
let activeSettingsUserId: string | null = null;
const appliedSettingsListeners = new Set<(settings: UserSettings) => void>();

function notifyAppliedSettings(settings: UserSettings) {
	for (const listener of appliedSettingsListeners) listener(settings);
}

export function onUserSettingsApplied(listener: (settings: UserSettings) => void): () => void {
	appliedSettingsListeners.add(listener);
	return () => appliedSettingsListeners.delete(listener);
}

function currentSettings(): UserSettings {
	return {
		lang: _lang,
		timeZone: _timeZone,
		theme: _theme,
		colorScheme: _colorScheme,
		shortcuts: _shortcuts,
		showRecipes: _showRecipes,
		supplementSortOrder: _supplementSortOrder,
		waterTrackerEnabled: _waterTrackerEnabled,
		waterGoalMl: _waterGoalMl,
		waterPresets: _waterPresets,
		caffeineTrackerEnabled: _caffeineTrackerEnabled,
		caffeineLimitMg: _caffeineLimitMg,
		caffeineHiddenDrinks: _caffeineHiddenDrinks,
		caffeineCustomAmounts: _caffeineCustomAmounts,
		meditationTrackerEnabled: _meditationTrackerEnabled,
		meditationDailyGoalMinutes: _meditationDailyGoalMinutes,
		meditationDefaultDurationMinutes: _meditationDefaultDurationMinutes,
		meditationPrepSeconds: _meditationPrepSeconds,
		meditationStartSound: _meditationStartSound,
		meditationEndSound: _meditationEndSound,
		meditationVolume: _meditationVolume,
		moodTrackerEnabled: _moodTrackerEnabled,
		moodWeeklyReviewEnabled: _moodWeeklyReviewEnabled,
		dismissedMoodWeeklyReviewWeek: _dismissedMoodWeeklyReviewWeek,
		nutritionTrackerEnabled: _nutritionTrackerEnabled,
		nutritionMealSubdivisionsEnabled: _nutritionMealSubdivisionsEnabled,
		aiNutritionProvider: _aiNutritionProvider,
		aiGeminiApiKey: _aiGeminiApiKey,
		aiGeminiModel: _aiGeminiModel,
		aiOpenaiApiKey: _aiOpenaiApiKey,
		aiOpenaiModel: _aiOpenaiModel,
		hiddenMoodTags: _hiddenMoodTags,
		greetingEnabled: _greetingEnabled,
		wakeLockRecipes: _wakeLockRecipes,
		wakeLockMeditation: _wakeLockMeditation
	};
}

function scheduleSave(patch: UserSettingsPatch) {
	const settings = currentSettings();
	const userId = activeSettingsUserId;
	saveCache(settings, userId);
	if (userId) {
		_persistPromise = _persistPromise
			.catch(() => {})
			.then(() => queueUserSettingsPatch(userId, patch, settings));
	}
	if (_saveTimer) clearTimeout(_saveTimer);
	_saveTimer = setTimeout(async () => {
		await _persistPromise.catch(() => {});
		if (activeSettingsUserId === userId) void drainPendingMutations();
	}, 500);
}

// For UI actions whose persistence must survive an immediate suspend: wait until
// the durable mutation exists, then attempt the server sync right away.
export async function flushUserSettings(): Promise<void> {
	const userId = activeSettingsUserId;
	await _persistPromise.catch(() => {});
	if (userId && activeSettingsUserId === userId) await drainPendingMutations();
}

export const userSettings = {
	get lang() { return _lang; },
	set lang(v: Locale) { _lang = v; scheduleSave({ lang: v }); },
	get timeZone() { return _timeZone; },
	set timeZone(v: string) { _timeZone = v; scheduleSave({ timeZone: v }); },

	// Show recipes tab in navigation (default: true)
	get showRecipes() { return _showRecipes; },
	set showRecipes(v: boolean) { _showRecipes = v; scheduleSave({ showRecipes: v }); },

	// Theme
	get theme() { return _theme; },
	set theme(v: 'system' | 'light' | 'dark') { _theme = v; scheduleSave({ theme: v }); },
	get colorScheme() { return _colorScheme; },
	set colorScheme(v: 'crimson' | 'forest' | 'classic' | 'indigo') { _colorScheme = v; scheduleSave({ colorScheme: v }); },

	// Supplement sort order
	get supplementSortOrder() { return _supplementSortOrder; },
	set supplementSortOrder(v: 'az' | 'za' | 'freq') { _supplementSortOrder = v; scheduleSave({ supplementSortOrder: v }); },

	// Water tracker
	get waterTrackerEnabled() { return _waterTrackerEnabled; },
	set waterTrackerEnabled(v: boolean) { _waterTrackerEnabled = v; scheduleSave({ waterTrackerEnabled: v }); },
	get waterGoalMl() { return _waterGoalMl; },
	set waterGoalMl(v: number) { _waterGoalMl = v; scheduleSave({ waterGoalMl: v }); },
	get waterPresets() { return _waterPresets; },
	set waterPresets(v: [number, number]) { _waterPresets = v; scheduleSave({ waterPresets: v }); },

	// Caffeine tracker
	get caffeineTrackerEnabled() { return _caffeineTrackerEnabled; },
	set caffeineTrackerEnabled(v: boolean) { _caffeineTrackerEnabled = v; scheduleSave({ caffeineTrackerEnabled: v }); },
	get caffeineLimitMg() { return _caffeineLimitMg; },
	set caffeineLimitMg(v: number) { _caffeineLimitMg = v; scheduleSave({ caffeineLimitMg: v }); },
	get caffeineHiddenDrinks() { return _caffeineHiddenDrinks; },
	set caffeineHiddenDrinks(v: string[]) { _caffeineHiddenDrinks = v; scheduleSave({ caffeineHiddenDrinks: v }); },
	get caffeineCustomAmounts() { return _caffeineCustomAmounts; },
	set caffeineCustomAmounts(v: Record<string, number>) { _caffeineCustomAmounts = v; scheduleSave({ caffeineCustomAmounts: v }); },

	// Meditation tracker
	get meditationTrackerEnabled() { return _meditationTrackerEnabled; },
	set meditationTrackerEnabled(v: boolean) { _meditationTrackerEnabled = v; scheduleSave({ meditationTrackerEnabled: v }); },
	get meditationDailyGoalMinutes() { return _meditationDailyGoalMinutes; },
	set meditationDailyGoalMinutes(v: number) { _meditationDailyGoalMinutes = v; scheduleSave({ meditationDailyGoalMinutes: v }); },
	get meditationDefaultDurationMinutes() { return _meditationDefaultDurationMinutes; },
	set meditationDefaultDurationMinutes(v: number) { _meditationDefaultDurationMinutes = v; scheduleSave({ meditationDefaultDurationMinutes: v }); },
	get meditationPrepSeconds() { return _meditationPrepSeconds; },
	set meditationPrepSeconds(v: number) { _meditationPrepSeconds = v; scheduleSave({ meditationPrepSeconds: v }); },
	get meditationStartSound() { return _meditationStartSound; },
	set meditationStartSound(v: string) { _meditationStartSound = v; scheduleSave({ meditationStartSound: v }); },
	get meditationEndSound() { return _meditationEndSound; },
	set meditationEndSound(v: string) { _meditationEndSound = v; scheduleSave({ meditationEndSound: v }); },
	get meditationVolume() { return _meditationVolume; },
	set meditationVolume(v: number) { _meditationVolume = v; scheduleSave({ meditationVolume: v }); },

	// Mood tracker
	get moodTrackerEnabled() { return _moodTrackerEnabled; },
	set moodTrackerEnabled(v: boolean) { _moodTrackerEnabled = v; scheduleSave({ moodTrackerEnabled: v }); },
	get moodWeeklyReviewEnabled() { return _moodWeeklyReviewEnabled; },
	set moodWeeklyReviewEnabled(v: boolean) { _moodWeeklyReviewEnabled = v; scheduleSave({ moodWeeklyReviewEnabled: v }); },
	get dismissedMoodWeeklyReviewWeek() { return _dismissedMoodWeeklyReviewWeek; },
	set dismissedMoodWeeklyReviewWeek(v: string) { _dismissedMoodWeeklyReviewWeek = v; scheduleSave({ dismissedMoodWeeklyReviewWeek: v }); },
	get nutritionTrackerEnabled() { return _nutritionTrackerEnabled; },
	set nutritionTrackerEnabled(v: boolean) { _nutritionTrackerEnabled = v; scheduleSave({ nutritionTrackerEnabled: v }); },
	get nutritionMealSubdivisionsEnabled() { return _nutritionMealSubdivisionsEnabled; },
	set nutritionMealSubdivisionsEnabled(v: boolean) { _nutritionMealSubdivisionsEnabled = v; scheduleSave({ nutritionMealSubdivisionsEnabled: v }); },
	get aiNutritionProvider() { return _aiNutritionProvider; },
	set aiNutritionProvider(v: 'gemini' | 'openai') { _aiNutritionProvider = v; scheduleSave({ aiNutritionProvider: v }); },
	get aiGeminiApiKey() { return _aiGeminiApiKey; },
	set aiGeminiApiKey(v: string) { _aiGeminiApiKey = v; scheduleSave({ aiGeminiApiKey: v }); },
	get aiGeminiModel() { return _aiGeminiModel; },
	set aiGeminiModel(v: string) { _aiGeminiModel = v; scheduleSave({ aiGeminiModel: v }); },
	get aiOpenaiApiKey() { return _aiOpenaiApiKey; },
	set aiOpenaiApiKey(v: string) { _aiOpenaiApiKey = v; scheduleSave({ aiOpenaiApiKey: v }); },
	get aiOpenaiModel() { return _aiOpenaiModel; },
	set aiOpenaiModel(v: 'gpt-4o-mini' | 'gpt-4o') { _aiOpenaiModel = v; scheduleSave({ aiOpenaiModel: v }); },
	get hiddenMoodTags() { return _hiddenMoodTags; },
	set hiddenMoodTags(v: string[]) { _hiddenMoodTags = v; scheduleSave({ hiddenMoodTags: v }); },
	get greetingEnabled() { return _greetingEnabled; },
	set greetingEnabled(v: boolean) { _greetingEnabled = v; scheduleSave({ greetingEnabled: v }); },
	get wakeLockRecipes() { return _wakeLockRecipes; },
	set wakeLockRecipes(v: boolean) { _wakeLockRecipes = v; scheduleSave({ wakeLockRecipes: v }); },
	get wakeLockMeditation() { return _wakeLockMeditation; },
	set wakeLockMeditation(v: boolean) { _wakeLockMeditation = v; scheduleSave({ wakeLockMeditation: v }); },

	// Shortcuts
	get shortcuts() { return _shortcuts; },
	addShortcut(s: Shortcut) {
		if (_shortcuts.length >= MAX_SHORTCUTS) return;
		_shortcuts = normalizeShortcuts([..._shortcuts, s]);
		scheduleSave({ shortcuts: _shortcuts });
	},
	updateShortcut(id: string, changes: Partial<Omit<Shortcut, 'id'>>) {
		_shortcuts = normalizeShortcuts(_shortcuts.map(s => s.id === id ? { ...s, ...changes } : s));
		scheduleSave({ shortcuts: _shortcuts });
	},
	removeShortcut(id: string) {
		_shortcuts = _shortcuts.filter(s => s.id !== id);
		scheduleSave({ shortcuts: _shortcuts });
	}
};

function applySettings(settings: UserSettings) {
	_lang = settings.lang ?? DEFAULT_SETTINGS.lang;
	_timeZone = settings.timeZone ?? '';
	_shortcuts = normalizeShortcuts(settings.shortcuts);
	_showRecipes = settings.showRecipes ?? true;
	_theme = settings.theme ?? 'system';
	_colorScheme = settings.colorScheme ?? 'crimson';
	_supplementSortOrder = settings.supplementSortOrder ?? 'az';
	_waterTrackerEnabled = settings.waterTrackerEnabled ?? true;
	_waterGoalMl = settings.waterGoalMl ?? 2000;
	_waterPresets = settings.waterPresets ?? [100, 200];
	_caffeineTrackerEnabled = settings.caffeineTrackerEnabled ?? true;
	_caffeineLimitMg = settings.caffeineLimitMg ?? 400;
	_caffeineHiddenDrinks = settings.caffeineHiddenDrinks ?? [];
	_caffeineCustomAmounts = settings.caffeineCustomAmounts ?? {};
	_meditationTrackerEnabled = settings.meditationTrackerEnabled ?? true;
	_meditationDailyGoalMinutes = settings.meditationDailyGoalMinutes ?? 15;
	_meditationDefaultDurationMinutes = settings.meditationDefaultDurationMinutes ?? 10;
	_meditationPrepSeconds = settings.meditationPrepSeconds ?? 20;
	_meditationStartSound = settings.meditationStartSound ?? 'zen-tone-mid.mp3';
	_meditationEndSound = settings.meditationEndSound ?? 'auk-zen-gong.mp3';
	_meditationVolume = settings.meditationVolume ?? 70;
	_moodTrackerEnabled = settings.moodTrackerEnabled ?? true;
	_moodWeeklyReviewEnabled = settings.moodWeeklyReviewEnabled ?? true;
	_dismissedMoodWeeklyReviewWeek = settings.dismissedMoodWeeklyReviewWeek ?? '';
	_nutritionTrackerEnabled = settings.nutritionTrackerEnabled ?? true;
	_nutritionMealSubdivisionsEnabled = settings.nutritionMealSubdivisionsEnabled ?? true;
	_aiNutritionProvider = settings.aiNutritionProvider ?? 'gemini';
	_aiGeminiApiKey = settings.aiGeminiApiKey ?? '';
	const sGeminiModel = settings.aiGeminiModel;
	_aiGeminiModel = sGeminiModel && !['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite'].includes(sGeminiModel)
		? sGeminiModel
		: 'gemini-flash-lite-latest';
	_aiOpenaiApiKey = settings.aiOpenaiApiKey ?? '';
	_aiOpenaiModel = settings.aiOpenaiModel ?? 'gpt-4o-mini';
	_hiddenMoodTags = settings.hiddenMoodTags ?? [];
	_greetingEnabled = settings.greetingEnabled ?? true;
	_wakeLockRecipes = settings.wakeLockRecipes ?? true;
	_wakeLockMeditation = settings.wakeLockMeditation ?? true;
}

export function seedSettings(settings: UserSettings, userId: string | null = activeSettingsUserId) {
	activeSettingsUserId = userId;
	applySettings(settings);
	saveCache(currentSettings(), userId);
}

export async function initUserSettings(
	userId: string | null,
	serverSettings: UserSettings = {},
	settingsRevision = 0
): Promise<UserSettings | null> {
	if (!browser) return null;
	activeSettingsUserId = userId;
	if (!userId) {
		applySettings({});
		return null;
	}

	const cached = loadCache(userId);
	applySettings(Object.keys(cached).length > 0 ? cached : serverSettings);
	const row = await refreshUserSettings(userId, {
		settings: serverSettings,
		settingsRevision
	});
	if (activeSettingsUserId !== userId) return null;
	const effective = row.settings as UserSettings;
	applySettings(effective);
	saveCache(currentSettings(), userId);
	notifyAppliedSettings(effective);
	return effective;
}

export async function refreshActiveUserSettings(): Promise<UserSettings | null> {
	const userId = activeSettingsUserId;
	if (!browser || !userId) return null;
	await _persistPromise.catch(() => {});
	if (activeSettingsUserId !== userId) return null;
	const cached = loadCache(userId);
	const row = await refreshUserSettings(userId, {
		settings: cached,
		settingsRevision: 0
	});
	if (activeSettingsUserId !== userId) return null;
	const effective = row.settings as UserSettings;
	applySettings(effective);
	saveCache(currentSettings(), userId);
	notifyAppliedSettings(effective);
	return effective;
}
