import type { Shortcut, ShortcutAction } from '#lib/userSettingsTypes';

/** Actions offered when creating a shortcut. */
export const SHORTCUT_ACTIONS: ShortcutAction[] = ['log-meal', 'log-supplement', 'log-water', 'log-caffeine', 'log-mood', 'log-meditation'];
// 'log-tracker' (open the tracker tab) predates the per-tracker actions; existing shortcuts keep working.
const VALID_ACTIONS: ShortcutAction[] = [...SHORTCUT_ACTIONS, 'log-tracker'];
export const MAX_SHORTCUTS = 4;

export function isShortcutAction(action: unknown): action is ShortcutAction {
	return typeof action === 'string' && VALID_ACTIONS.includes(action as ShortcutAction);
}

// Remove retired actions (e.g. the former shopping-list ones) from stored settings and older clients' queued writes.
export function normalizeShortcuts(value: unknown): Shortcut[] {
	if (!Array.isArray(value)) return [];
	const result: Shortcut[] = [];
	const ids = new Set<string>();
	for (const entry of value) {
		if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id
			|| ids.has(entry.id) || typeof entry.name !== 'string' || !entry.name.trim() || !isShortcutAction(entry.action)) continue;
		ids.add(entry.id);
		result.push({ id: entry.id, name: entry.name.trim(), action: entry.action });
		if (result.length === MAX_SHORTCUTS) break;
	}
	return result;
}

export function shortcutTarget(shortcut: Shortcut): string | null {
	return isShortcutAction(shortcut.action) ? `/?action=${shortcut.action}` : null;
}
