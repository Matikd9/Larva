import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb } from '#lib/sync/db';
import {
	drainPendingMutations,
	getOfflineUserSettings,
	initSync,
	queueUserSettingsPatch,
	refreshUserSettings
} from '#lib/sync/manager';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('offline user settings', () => {
	beforeEach(async () => {
		initSync(null);
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		offlineDb.close();
		await offlineDb.delete();
		await offlineDb.open();
	});

	afterAll(async () => {
		initSync(null);
		offlineDb.close();
		await offlineDb.delete();
	});

	it('stores an offline settings change and its pending marker for exactly one user', async () => {
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { hiddenMoodTags: ['snacks', 'obst'] }, {
			greetingEnabled: true,
			hiddenMoodTags: ['snacks', 'obst']
		});

		const pending = await offlineDb.pendingMutations.toArray();
		expect(pending).toHaveLength(1);
		expect(pending[0]).toMatchObject({ type: 'update_user_settings', userId: 'user-a' });
		expect(await getOfflineUserSettings('user-a')).toMatchObject({
			userId: 'user-a',
			settings: { hiddenMoodTags: ['snacks', 'obst'] }
		});
		expect(await getOfflineUserSettings('user-b')).toBeUndefined();
	});

	it('stores reactive-style proxy settings as plain IndexedDB data', async () => {
		initSync('user-a');
		const hiddenMoodTags = new Proxy(['snacks', 'obst'], {});
		const effectiveSettings = new Proxy({
			lang: 'en' as const,
			hiddenMoodTags
		}, {});

		await queueUserSettingsPatch('user-a', { lang: 'en' }, effectiveSettings);

		const pending = await offlineDb.pendingMutations.toArray();
		expect(pending).toHaveLength(1);
		expect(pending[0].payload.settings).toEqual({ lang: 'en' });
		expect((await getOfflineUserSettings('user-a'))?.settings).toEqual({
			lang: 'en',
			hiddenMoodTags: ['snacks', 'obst']
		});
	});

	it('coalesces repeated changes into one durable mutation', async () => {
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { waterGoalMl: 2000 }, { waterGoalMl: 2000 });
		await queueUserSettingsPatch('user-a', { caffeineLimitMg: 300 }, { waterGoalMl: 2000, caffeineLimitMg: 300 });

		const pending = await offlineDb.pendingMutations.toArray();
		expect(pending).toHaveLength(1);
		expect(pending[0].payload.settings).toEqual({ waterGoalMl: 2000, caffeineLimitMg: 300 });

		offlineDb.close();
		await offlineDb.open();
		expect((await offlineDb.pendingMutations.toArray())).toHaveLength(1);
	});

	it('retries a queued patch and removes it only after the server confirms it', async () => {
		await offlineDb.userSettings.put({ userId: 'user-a', settings: { theme: 'system' }, revision: 4, updatedAt: 1 });
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { theme: 'dark' }, { theme: 'dark' });
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
			ok: true,
			settings: { theme: 'dark' },
			settingsRevision: 5
		}));
		vi.stubGlobal('fetch', fetchMock);

		await drainPendingMutations();

		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
			settings: { theme: 'dark' },
			settingsRevision: 4
		});
		expect(await getOfflineUserSettings('user-a')).toMatchObject({ settings: { theme: 'dark' }, revision: 5 });
	});

	it('recognizes an already-applied patch after a lost response without writing twice', async () => {
		await offlineDb.userSettings.put({ userId: 'user-a', settings: { theme: 'system' }, revision: 3, updatedAt: 1 });
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { theme: 'dark' }, { theme: 'dark' });
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
			error: 'settings_conflict',
			settings: { theme: 'dark' },
			settingsRevision: 4
		}, 409));
		vi.stubGlobal('fetch', fetchMock);

		await drainPendingMutations();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(await getOfflineUserSettings('user-a')).toMatchObject({ settings: { theme: 'dark' }, revision: 4 });
	});

	it('rebases a conflicting patch onto another session’s newer settings', async () => {
		await offlineDb.userSettings.put({ userId: 'user-a', settings: { theme: 'system' }, revision: 1, updatedAt: 1 });
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { theme: 'dark' }, { theme: 'dark' });
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(jsonResponse({
				error: 'settings_conflict',
				settings: { theme: 'system', hiddenMoodTags: ['obst', 'snacks'] },
				settingsRevision: 2
			}, 409))
			.mockResolvedValueOnce(jsonResponse({
				ok: true,
				settings: { theme: 'dark', hiddenMoodTags: ['obst', 'snacks'] },
				settingsRevision: 3
			}));
		vi.stubGlobal('fetch', fetchMock);

		await drainPendingMutations();

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const retryBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
		expect(retryBody).toEqual({ settings: { theme: 'dark' }, settingsRevision: 2 });
		expect(await getOfflineUserSettings('user-a')).toMatchObject({
			settings: { theme: 'dark', hiddenMoodTags: ['obst', 'snacks'] },
			revision: 3
		});
	});

	it('keeps a local pending sort order over a stale server response during reload', async () => {
		await offlineDb.userSettings.put({ userId: 'user-a', settings: { hiddenMoodTags: ['obst'] }, revision: 2, updatedAt: 1 });
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { hiddenMoodTags: ['snacks', 'obst'] }, {
			hiddenMoodTags: ['snacks', 'obst']
		});
		const fetchMock = vi.fn()
			.mockRejectedValueOnce(new TypeError('offline during drain'))
			.mockResolvedValueOnce(jsonResponse({
				settings: { hiddenMoodTags: ['obst'] },
				settingsRevision: 2
			}));
		vi.stubGlobal('fetch', fetchMock);

		const row = await refreshUserSettings('user-a', {
			settings: { hiddenMoodTags: ['obst'] },
			settingsRevision: 2
		});

		expect(row.settings.hiddenMoodTags).toEqual(['snacks', 'obst']);
		expect(await offlineDb.pendingMutations.count()).toBe(1);
	});

	it('never sends another user’s pending settings under the active account', async () => {
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { theme: 'dark' }, { theme: 'dark' });
		initSync('user-b');
		await queueUserSettingsPatch('user-b', { theme: 'light' }, { theme: 'light' });
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
			ok: true,
			settings: { theme: 'light' },
			settingsRevision: 1
		}));
		vi.stubGlobal('fetch', fetchMock);

		await drainPendingMutations();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const remaining = await offlineDb.pendingMutations.toArray();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].userId).toBe('user-a');
	});

	it('does not fetch a new account into the previous user’s cache during an account switch', async () => {
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { theme: 'dark' }, { theme: 'dark' });
		let resolvePatch!: (response: Response) => void;
		const fetchMock = vi.fn()
			.mockImplementationOnce(() => new Promise<Response>(resolve => { resolvePatch = resolve; }));
		vi.stubGlobal('fetch', fetchMock);

		const refresh = refreshUserSettings('user-a', {
			settings: { theme: 'system' },
			settingsRevision: 0
		});
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		initSync('user-b');
		resolvePatch(jsonResponse({ ok: true, settings: { theme: 'dark' }, settingsRevision: 1 }));
		await refresh;

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(await getOfflineUserSettings('user-a')).toMatchObject({ settings: { theme: 'dark' }, revision: 1 });
		expect(await getOfflineUserSettings('user-b')).toBeUndefined();
	});

	it('does not lose a second local edit made while the first request is in flight', async () => {
		await offlineDb.userSettings.put({ userId: 'user-a', settings: { theme: 'system' }, revision: 0, updatedAt: 1 });
		initSync('user-a');
		await queueUserSettingsPatch('user-a', { theme: 'dark' }, { theme: 'dark' });
		let resolveFirst!: (response: Response) => void;
		const fetchMock = vi.fn()
			.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFirst = resolve; }))
			.mockResolvedValueOnce(jsonResponse({
				ok: true,
				settings: { theme: 'dark', greetingEnabled: false },
				settingsRevision: 2
			}));
		vi.stubGlobal('fetch', fetchMock);

		const drain = drainPendingMutations();
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await queueUserSettingsPatch('user-a', { greetingEnabled: false }, {
			theme: 'dark',
			greetingEnabled: false
		});
		resolveFirst(jsonResponse({ ok: true, settings: { theme: 'dark' }, settingsRevision: 1 }));
		await drain;

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(await getOfflineUserSettings('user-a')).toMatchObject({
			settings: { theme: 'dark', greetingEnabled: false },
			revision: 2
		});
	});
});
