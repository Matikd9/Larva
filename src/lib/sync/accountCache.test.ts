import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb } from './db';
import { migrateAccountCache } from './accountCache';
import { cacheRecipes, cacheRecipeDetail, cacheWaterLogs, cacheCaffeineLogs, cacheMeditationLogs, drainPendingMutations, getOfflineRecipes, getOfflineRecipeDetail, getOfflineWaterLogsToday, getOfflineCaffeineLogsToday, getOfflineMeditationLogsToday, initSync } from './manager';

beforeEach(async () => {
	initSync(null); vi.restoreAllMocks(); vi.unstubAllGlobals();
	offlineDb.close(); await offlineDb.delete(); await offlineDb.open();
});
afterAll(async () => { initSync(null); offlineDb.close(); await offlineDb.delete(); });

describe('private offline caches', () => {
	it('isolates recipes, details and tracker logs across account switches and reloads', async () => {
		initSync('alice');
		const recipe = { id: 'recipe-a', title: 'Private recipe', description: null, imageUrl: null, servings: 2, prepTime: null, cookTime: null, updatedAt: 1 };
		await cacheRecipes([recipe]);
		await cacheRecipeDetail({ ...recipe, sourceUrl: null, ingredients: [], steps: [] });
		await cacheWaterLogs([{ id: 'water-a', amountMl: 250, loggedAt: Date.now() }]);
		await cacheCaffeineLogs([{ id: 'coffee-a', drinkName: 'Coffee', caffeineMg: 80, amountMl: 125, loggedAt: Date.now() }]);
		await cacheMeditationLogs([{ id: 'meditation-a', durationSeconds: 300, loggedAt: Date.now() }]);
		initSync('bob');
		expect(await getOfflineRecipes()).toEqual([]);
		expect(await getOfflineRecipeDetail(recipe.id)).toBeUndefined();
		expect(await getOfflineWaterLogsToday()).toEqual([]);
		expect(await getOfflineCaffeineLogsToday()).toEqual([]);
		expect(await getOfflineMeditationLogsToday()).toEqual([]);
		initSync(null);
		expect(await getOfflineRecipes()).toEqual([]);
		offlineDb.close(); await offlineDb.open();
		initSync('alice');
		expect(await getOfflineRecipes()).toHaveLength(1);
		expect(await getOfflineRecipeDetail(recipe.id)).toBeDefined();
		expect(await getOfflineWaterLogsToday()).toHaveLength(1);
	});

	it('keeps a delayed response assigned to its originating account', async () => {
		initSync('bob');
		await cacheRecipes([{ id: 'late-a', title: 'Alice', description: null, imageUrl: null, servings: 1, prepTime: null, cookTime: null, updatedAt: 1 }], 'alice');
		expect(await getOfflineRecipes()).toEqual([]);
		initSync('alice');
		expect(await getOfflineRecipes()).toHaveLength(1);
	});

	it('upgrades a version-7 IndexedDB, keeps tracker writes with their owner and drops shopping-list writes', async () => {
		offlineDb.close(); await offlineDb.delete();
		const legacy = new Dexie('groly');
		legacy.version(7).stores({
			lists: 'id, ownerId, updatedAt', items: 'id, listId, isChecked, updatedAt', pendingMutations: '++id, type, userId, createdAt',
			supplements: 'id, updatedAt', supplementLogs: 'id, supplementId, loggedAt', recipes: 'id, updatedAt', recipeDetails: 'id',
			waterLogs: 'id, loggedAt', caffeineLogs: 'id, loggedAt', meditationLogs: 'id, loggedAt', caffeineDrinks: 'id, sortOrder',
			categoryPreferences: '[userId+normalizedName], userId, updatedAt', userSettings: 'userId, updatedAt'
		});
		await legacy.table('pendingMutations').add({ type: 'create_item', payload: { id: 'milk', listId: 'family', name: 'Milk' }, createdAt: Date.now() });
		await legacy.table('pendingMutations').add({ type: 'create_water_log', payload: { clientLogId: 'legacy-log', amountMl: 250, loggedAt: Date.now() }, createdAt: Date.now() });
		await legacy.table('waterLogs').add({ id: 'legacy-log', amountMl: 250, loggedAt: Date.now() });
		legacy.close(); await offlineDb.open();
		expect((await offlineDb.pendingMutations.toArray()).map(mutation => mutation.type)).toEqual(['create_water_log']);
		expect(offlineDb.tables.map(table => table.name)).not.toContain('lists');
		await migrateAccountCache('alice');
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true })); vi.stubGlobal('fetch', fetchMock);
		initSync('bob'); await drainPendingMutations();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(await offlineDb.pendingMutations.count()).toBe(1);
		expect(await getOfflineWaterLogsToday()).toEqual([]);
		// A later account cannot steal the legacy migration by running it again.
		await migrateAccountCache('bob');
		initSync('alice');
		expect(await getOfflineWaterLogsToday()).toHaveLength(1);
		await drainPendingMutations();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][1].headers['X-Groly-User']).toBe('alice');
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('preserves writes with unknown legacy ownership instead of sending them as the next user', async () => {
		await offlineDb.pendingMutations.add({ type: 'create_water_log', payload: { amountMl: 250, loggedAt: Date.now() }, createdAt: Date.now() });
		await migrateAccountCache(null);
		const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
		initSync('bob'); await drainPendingMutations();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(await offlineDb.pendingMutations.count()).toBe(1);
	});
});
