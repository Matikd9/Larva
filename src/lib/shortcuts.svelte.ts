// Shortcuts are stored as part of userSettings so they sync to the server
// and are available across all devices for the user.
export type { Shortcut, ShortcutAction } from '#lib/userSettingsTypes';

import { goto } from '$app/navigation';
import { t } from '#lib/i18n.svelte';
import { shortcutTarget } from '#lib/shortcutActions';
import type { ShortcutAction } from '#lib/userSettingsTypes';
import { userSettings } from '#lib/userSettings.svelte';
import type { Shortcut } from '#lib/userSettingsTypes';

export const shortcuts = {
	get list() { return userSettings.shortcuts; },
	add(s: Shortcut) { userSettings.addShortcut(s); },
	update(id: string, changes: Partial<Omit<Shortcut, 'id'>>) { userSettings.updateShortcut(id, changes); },
	remove(id: string) { userSettings.removeShortcut(id); }
};

// Global shortcut-menu visibility — rendered in +layout.svelte to avoid
// stacking-context interference from BottomNav (z-30 creates its own context).
let _menuOpen = $state(false);

export const shortcutMenu = {
	get open() { return _menuOpen; },
	show() { _menuOpen = true; },
	hide() { _menuOpen = false; }
};


export function shortcutActionLabel(action: ShortcutAction): string {
	switch (action) {
		case 'log-meal': return t.shortcut_action_meal;
		case 'log-supplement': return t.shortcut_action_supplements;
		case 'log-water': return t.shortcut_action_water;
		case 'log-caffeine': return t.shortcut_action_caffeine;
		case 'log-mood': return t.shortcut_action_mood;
		case 'log-meditation': return t.shortcut_action_meditation;
		case 'log-tracker': return t.shortcut_action_tracker;
	}
}

export function executeShortcut(shortcut: Shortcut) {
	const target = shortcutTarget(shortcut);
	if (!target) return;
	void goto(target);
}
