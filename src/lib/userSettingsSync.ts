import { normalizeShortcuts } from '#lib/shortcutActions';
import type { UserSettings } from '#lib/userSettingsTypes';

export type UserSettingsPatch = Partial<UserSettings>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeUserSettingsPatch(value: unknown): UserSettingsPatch | null {
	if (!isRecord(value)) return null;
	let plainValue: unknown;
	try {
		// Settings can originate from Svelte 5's deeply proxied $state values. IndexedDB
		// uses the structured-clone algorithm and rejects those proxies, while a JSON
		// round-trip produces the plain data shape that the API and cache expect.
		plainValue = JSON.parse(JSON.stringify(value));
	} catch {
		return null;
	}
	if (!isRecord(plainValue)) return null;
	const patch = plainValue as UserSettingsPatch;
	if (plainValue.shortcuts !== undefined) {
		if (!Array.isArray(plainValue.shortcuts)) return null;
		patch.shortcuts = normalizeShortcuts(plainValue.shortcuts);
	}
	return patch;
}

export function hasExplicitUserLanguage(settings: UserSettings): boolean {
	return settings.lang === 'de' || settings.lang === 'en';
}

export function applyUserSettingsPatch(base: UserSettings, patch: UserSettingsPatch): UserSettings {
	return { ...base, ...patch };
}

export function combineUserSettingsPatches(previous: UserSettingsPatch, next: UserSettingsPatch): UserSettingsPatch {
	return { ...previous, ...next };
}

function equalValue(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function userSettingsPatchMatches(settings: UserSettings, patch: UserSettingsPatch): boolean {
	return Object.entries(patch).every(([key, value]) => equalValue(settings[key as keyof UserSettings], value));
}
