import * as m from '#lib/paraglide/messages';
import { getLocale, setLocale, type Locale } from '#lib/paraglide/runtime';
import { browser } from '$app/env';
import { userSettings, initUserSettings, onUserSettingsApplied } from '#lib/userSettings.svelte';
import type { UserSettings } from '#lib/userSettingsTypes';
import { hasExplicitUserLanguage } from '#lib/userSettingsSync';
import { languageFromBrowserLanguage } from '#lib/language';

let _lang = $state<Locale>('en');
let initializedUserId: string | null | undefined;
let initializationToken = 0;

if (browser) {
	onUserSettingsApplied((settings) => {
		const lang = settings.lang ?? 'en';
		setLocale(lang, { reload: false });
		_lang = lang;
		document.documentElement.lang = lang;
		try { localStorage.setItem('groly_ui_lang', lang); } catch { /* Storage may be unavailable. */ }
	});
}

export function currentLang(): Locale {
	return browser ? _lang : getLocale();
}

export function setLang(lang: Locale) {
	setLocale(lang, { reload: false });
	_lang = lang;
	if (browser) {
		document.documentElement.lang = lang;
		try { localStorage.setItem('groly_ui_lang', lang); } catch { /* Storage may be unavailable. */ }
	}
	userSettings.lang = lang;
}

// Explicit locale for pages rendered before a user has signed in. A server
// request must not change Paraglide's process-wide language tag.
export function localizedMessages(lang: Locale): Record<NoArgMessages, string> {
	return new Proxy({} as Record<NoArgMessages, string>, {
		get(_target, key: string | symbol): string {
			if (typeof key !== 'string') return '';
			const fn = (m as Record<string, unknown>)[key];
			return typeof fn === 'function'
				? (fn as (params: {}, options: { locale: Locale }) => string)({}, { locale: lang })
				: '';
		}
	});
}

export async function initLanguage(
	userId: string | null,
	serverSettings: UserSettings = {},
	settingsRevision = 0,
	anonymousLang: Locale = 'en'
) {
	if (!browser) return;
	if (initializedUserId === userId) return;
	initializedUserId = userId;
	const token = ++initializationToken;
	// The layout supplies the raw stored JSON. Capture this before the settings
	// sync fills in defaults, otherwise the default `de` looks like a saved choice.
	const hasSavedLanguage = hasExplicitUserLanguage(serverSettings);
	// Load the user-scoped offline cache first, then reconcile with the server.
	const effectiveSettings = await initUserSettings(userId, serverSettings, settingsRevision);
	if (token !== initializationToken) return;
	if (userId) {
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (timeZone && effectiveSettings?.timeZone !== timeZone) userSettings.timeZone = timeZone;
	}
	const lang = userId ? userSettings.lang : anonymousLang;
	setLocale(lang, { reload: false });
	_lang = lang;
	document.documentElement.lang = lang;
	try { localStorage.setItem('groly_ui_lang', lang); } catch { /* Storage may be unavailable. */ }
	// If no explicit language preference was saved, detect from browser
	if (userId && !hasSavedLanguage) {
		setLang(languageFromBrowserLanguage(navigator.language));
	}
}

// Reactive translation proxy — each access reads _lang, creating a reactive dependency
// in any Svelte 5 reactive context (component render, $derived, $effect). Typed against
// the paraglide messages module so typos in `t.foo_bar` are still flagged by TypeScript.
type NoArgMessages = {
	[K in keyof typeof m]: typeof m[K] extends () => string ? K : never;
}[keyof typeof m];

export const t = new Proxy({} as Record<NoArgMessages, string>, {
	get(_target, key: string | symbol): string {
		void _lang; // register reactive dependency
		if (typeof key !== 'string') return '';
		const fn = (m as Record<string, unknown>)[key];
		return typeof fn === 'function' ? (fn as (inputs: {}, options: { locale: Locale }) => string)({}, { locale: currentLang() }) : '';
	}
});

// Parametric helpers with inline plural logic (Paraglide doesn't support ICU plural syntax)
export function recipeLimitReached(limit: number): string {
	void _lang;
	return m.recipe_limit_reached({ limit }, { locale: currentLang() });
}
export function sync_pending(count: number): string {
	void _lang;
	if (currentLang() === 'en') return `${count} pending sync`;
	return `${count} Sync offen`;
}
export function reminders_deactivated_for(name: string): string {
	void _lang;
	if (currentLang() === 'en') return `Reminders for "${name}" have been deactivated`;
	return `Erinnerungen für „${name}" wurden deaktiviert`;
}

export function nutrients_show_more(count: number): string {
	void _lang;
	if (currentLang() === 'en') return `Show ${count} more`;
	return `${count} weitere anzeigen`;
}

export function nutrition_kcal_remaining(kcal: string): string {
	void _lang;
	if (currentLang() === 'en') return `${kcal} kcal remaining`;
	return `Noch ${kcal} kcal frei`;
}

export function nutrition_kcal_over(kcal: string): string {
	void _lang;
	if (currentLang() === 'en') return `${kcal} kcal over goal`;
	return `${kcal} kcal über dem Ziel`;
}

export function nutrition_of_goal(goal: string): string {
	void _lang;
	return currentLang() === 'en' ? `of ${goal}` : `von ${goal}`;
}

export function nutrition_nutrients_per_100(unit: string): string {
	void _lang;
	return currentLang() === 'en' ? `Nutrients per 100 ${unit}` : `Nährwerte pro 100 ${unit}`;
}

export function today_reminders_label(count: number): string {
	void _lang;
	if (currentLang() === 'en') return count === 0 ? 'All done' : count === 1 ? '1 open' : `${count} open`;
	return count === 0 ? 'Alles erledigt' : count === 1 ? '1 offen' : `${count} offen`;
}


// History: sentences with numbers, built per language for natural word order.
export function history_days_logged(count: number, total: number): string {
	void _lang;
	return currentLang() === 'en' ? `${count} of ${total} days logged` : `${count} von ${total} Tagen erfasst`;
}
export function history_vs_previous(delta: string, period: 'week' | 'month', previousDays: number): string {
	void _lang;
	if (currentLang() === 'en') return `${delta} vs previous ${period} (${previousDays} days logged)`;
	return `${delta} ggü. ${period === 'week' ? 'Vorwoche' : 'Vormonat'} (${previousDays} Tage erfasst)`;
}
export function history_no_comparison(period: 'week' | 'month', minDays: number): string {
	void _lang;
	if (currentLang() === 'en') return `Comparison with the previous ${period} needs at least ${minDays} logged days in both`;
	return `Vergleich mit ${period === 'week' ? 'der Vorwoche' : 'dem Vormonat'} braucht in beiden mindestens ${minDays} erfasste Tage`;
}
export function history_goal_reached(count: number, of: number): string {
	void _lang;
	return currentLang() === 'en' ? `Goal reached on ${count} of ${of} logged days` : `Ziel an ${count} von ${of} erfassten Tagen erreicht`;
}
export function history_over_limit(count: number, of: number): string {
	void _lang;
	return currentLang() === 'en' ? `Over the limit on ${count} of ${of} logged days` : `Über dem Limit an ${count} von ${of} erfassten Tagen`;
}
export function history_vs_goal(delta: string): string {
	void _lang;
	return currentLang() === 'en' ? `${delta} vs goal` : `${delta} ggü. Ziel`;
}
export function history_sessions(count: number, avgMinutes: number): string {
	void _lang;
	return currentLang() === 'en' ? `${count} sessions · Ø ${avgMinutes} min each` : `${count} Sitzungen · Ø ${avgMinutes} min pro Sitzung`;
}
export function history_categories_logged(count: number, of: number): string {
	void _lang;
	return currentLang() === 'en' ? `${count} of ${of} categories` : `${count} von ${of} Bereichen`;
}
export function history_taken_days(count: number, of: number): string {
	void _lang;
	return currentLang() === 'en' ? `taken on ${count} of ${of} days` : `an ${count} von ${of} Tagen genommen`;
}
export function history_kcal_coverage(percent: number): string {
	void _lang;
	return currentLang() === 'en' ? `data for ${percent}% of kcal` : `Daten für ${percent} % der kcal`;
}

// AI endpoints answer with stable error codes; their own message text is not localised.
export function ai_error_message(code: string | undefined): string {
	void _lang;
	const en = currentLang() === 'en';
	switch (code) {
		case 'NO_API_KEY': return t.ai_nutrition_no_api_key;
		case 'rate_limited': return en ? 'Too many AI requests. Wait a few minutes and try again.' : 'Zu viele KI-Anfragen. Warte ein paar Minuten und versuche es erneut.';
		case 'AI_TIMEOUT': return en ? 'The AI service did not answer in time. Check your connection and try again.' : 'Der KI-Dienst hat nicht rechtzeitig geantwortet. Prüfe deine Verbindung und versuche es erneut.';
		case 'AI_CALL_FAILED': return en ? 'The AI service rejected the request. Check your API key and model in Settings.' : 'Der KI-Dienst hat die Anfrage abgelehnt. Prüfe API-Key und Modell in den Einstellungen.';
		case 'EMPTY_RESPONSE':
		case 'JSON_PARSE_FAILED': return en ? 'The AI returned no usable result. Try again.' : 'Die KI hat kein verwertbares Ergebnis geliefert. Versuche es erneut.';
		case 'NO_ITEMS_FOUND': return en ? 'No foods were recognised. Describe the meal in more detail.' : 'Keine Lebensmittel erkannt. Beschreibe die Mahlzeit genauer.';
		case 'input_required':
		case 'text_or_image_required': return en ? 'Add a description or a photo first.' : 'Füge zuerst eine Beschreibung oder ein Foto hinzu.';
		case 'invalid_json': return en ? 'The image is too large or could not be read.' : 'Das Bild ist zu groß oder konnte nicht gelesen werden.';
		default: return en ? 'AI analysis failed. Try again later.' : 'Die KI-Analyse ist fehlgeschlagen. Versuche es später erneut.';
	}
}
export function nutrition_macro_mismatch(macroKcal: number, kcal: number): string {
	void _lang;
	return currentLang() === 'en'
		? `Your macros add up to ${macroKcal} kcal, not ${kcal} kcal.`
		: `Deine Makros ergeben ${macroKcal} kcal statt ${kcal} kcal.`;
}
