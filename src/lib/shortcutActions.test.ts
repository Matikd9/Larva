import { describe, expect, it } from 'vitest';
import { normalizeShortcuts, shortcutTarget, SHORTCUT_ACTIONS } from './shortcutActions';
import { sanitizeUserSettingsPatch } from './userSettingsSync';

describe('quick-access actions', () => {
	it('drops retired shopping-list actions and keeps logging actions within the four-slot limit', () => {
		const retired = ['go', 'add', 'scanner', 'recipes'].map(action => ({ id: action, name: action, action, listId: 'family' }));
		const current = ['log-meal', 'log-water', 'log-tracker', 'log-mood', 'log-meditation'].map(action => ({ id: action, name: action, action }));
		expect(normalizeShortcuts([...retired, ...current]).map(shortcut => shortcut.action)).toEqual(['log-meal', 'log-water', 'log-tracker', 'log-mood']);
	});
	it('drops malformed and duplicate entries and strips stale list fields', () => {
		expect(normalizeShortcuts([null, { id: 'log', name: ' Water ', action: 'log-water', listId: 'family' }, { id: 'log', name: 'Duplicate', action: 'log-supplement' }]))
			.toEqual([{ id: 'log', name: 'Water', action: 'log-water' }]);
	});
	it('routes every action to the home screen', () => {
		for (const action of [...SHORTCUT_ACTIONS, 'log-tracker'] as const) {
			expect(shortcutTarget({ id: action, name: action, action })).toBe(`/?action=${action}`);
		}
	});
	it('cleans old clients and persisted offline patches so retired actions cannot return', () => {
		expect(sanitizeUserSettingsPatch({ shortcuts: [{ id: 'old', name: 'Milk', action: 'add', listId: 'x' }, { id: 'log', name: 'Supplements', action: 'log-supplement' }] })).toEqual({ shortcuts: [{ id: 'log', name: 'Supplements', action: 'log-supplement' }] });
		expect(sanitizeUserSettingsPatch({ shortcuts: {} })).toBeNull();
	});
});
