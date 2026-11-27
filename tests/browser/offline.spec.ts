import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { seedUpgradeFixture } from '../../scripts/docker-fixtures.mjs';
import de from '../../messages/de.json' with { type: 'json' };
import en from '../../messages/en.json' with { type: 'json' };

const image = process.env.GROLY_TEST_IMAGE;
test.skip(!image, 'Set GROLY_TEST_IMAGE to a locally built production image');
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();

type CachedRow = { id?: string; type?: string; amountMl?: number };
async function rows(page: Page, store: string): Promise<CachedRow[]> {
	return page.evaluate(store => new Promise<CachedRow[]>((resolve, reject) => {
		const open = indexedDB.open('groly');
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const db = open.result;
			const read = db.transaction(store).objectStore(store).getAll();
			read.onsuccess = () => { resolve(read.result); db.close(); };
			read.onerror = () => { reject(read.error); db.close(); };
		};
	}), store);
}

test('offline tracker logs survive reload and sync; cached and uncached recipes have usable views', async ({ page, context, request }) => {
	const id = `groly-offline-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	try {
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', id, '-p', '127.0.0.1:3100:3000',
			'--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'ADMIN_USERNAME=offline-bootstrap',
			'-e', 'ADMIN_PASSWORD=Groly-offline-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100',
			'-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', id, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page).toHaveURL('http://127.0.0.1:3100/');
		await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
		// The home screen shows today's meals and the daily log with the seeded water entry.
		await expect(page.getByText(de.nutrition_label, { exact: true }).first()).toBeVisible();
		await expect(page.getByText(de.daily_log_title, { exact: true })).toBeVisible();
		await expect.poll(async () => (await rows(page, 'waterLogs')).length).toBeGreaterThan(0);
		// Create a catalog entry whose detail page has never been opened.
		const created = await page.request.post('/api/recipes', { data: { title: 'Uncached recipe', servings: 2, ingredients: [], steps: [] } });
		expect(created.status()).toBe(201);
		const { id: uncachedId } = await created.json();
		await page.goto('/rezepte/upgrade-recipe');
		await expect(page.getByText('Gemüse', { exact: true })).toBeVisible();
		await expect.poll(async () => (await rows(page, 'recipeDetails')).some(row => row.id === 'upgrade-recipe')).toBe(true);
		await page.getByRole('button', { name: de.a11y_back, exact: true }).click();
		await expect(page.getByText('Uncached recipe', { exact: true })).toBeVisible();
		await expect.poll(async () => (await rows(page, 'recipes')).some(row => row.id === uncachedId)).toBe(true);
		await expect.poll(async () => (await rows(page, 'pendingMutations')).length).toBe(0);

		await context.setOffline(true);
		// Log water offline from the home screen (the same entry a shortcut or reminder opens).
		await page.goto('/?action=log-water');
		await page.getByRole('button', { name: /\+200/ }).click();
		await expect.poll(async () => (await rows(page, 'pendingMutations')).some(row => row.type === 'create_water_log')).toBe(true);
		// After an offline reload, today's daily log comes from IndexedDB; meals say they could not load.
		await page.reload();
		await expect(page.getByText(de.nutrition_load_error, { exact: true })).toBeVisible();
		await expect(page.getByText(de.water_title, { exact: true }).first()).toBeVisible();
		await expect.poll(async () => (await rows(page, 'waterLogs')).some(row => row.amountMl === 200)).toBe(true);

		// Exercise client navigation into a cached recipe, not only a cached HTML reload.
		await page.getByRole('button', { name: de.nav_recipes, exact: true }).click();
		await page.getByText('Gemüsepfanne 🥦', { exact: true }).click();
		await expect(page.getByText('Gemüse', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: `${de.recipe_instructions} (1)`, exact: true }).click();
		await expect(page.getByText('Gemüse anbraten.', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: de.a11y_back, exact: true }).click();
		await expect(page.locator('[data-recipe-card]')).toHaveCount(1);
		await expect(page.locator('[data-recipe-id="upgrade-recipe"] [data-recipe-meta]')).toHaveText('Familie');
		await page.getByText('Uncached recipe', { exact: true }).click();
		await expect(page.locator('[data-offline-unavailable]')).toContainText(de.offline_recipe_message);
		await expect(page.getByRole('heading', { name: de.offline_recipe_title })).toBeVisible();
		const heading = page.getByRole('heading', { name: de.offline_recipe_title });
		expect(await heading.evaluate(el => getComputedStyle(el).fontFamily)).not.toContain('Times');
		await page.evaluate(async () => {
			await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
		});
		await page.screenshot({ path: `test-results/${test.info().project.name}-offline-recipe.png`, fullPage: true });
		// Full navigation to a URL with neither cached HTML nor detail data uses the
		// self-contained fallback, including working language and recovery controls.
		await page.goto(`/rezepte/${uncachedId}?cold-offline=1`);
		await expect(page.locator('[data-offline-fallback]')).toBeVisible();
		await page.getByRole('button', { name: 'EN', exact: true }).click();
		await expect(page.getByText(en.offline_page_message, { exact: true })).toBeVisible();
		await page.setViewportSize({ width: 320, height: 568 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		for (const scheme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme: scheme });
			await expect(page.getByRole('button', { name: en.offline_retry, exact: true })).toBeVisible();
			await page.screenshot({ path: `test-results/${test.info().project.name}-offline-${scheme}.png`, fullPage: true });
		}
		await page.getByRole('link', { name: en.offline_home, exact: true }).click();
		await expect(page.getByText(de.daily_log_title, { exact: true })).toBeVisible();
		await page.goto(`/rezepte/${uncachedId}?cold-offline=2`);
		await expect(page.locator('[data-offline-fallback]')).toBeVisible();
		await page.getByRole('button', { name: 'EN', exact: true }).click();
		await context.setOffline(false);
		await page.getByRole('button', { name: en.offline_retry, exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Uncached recipe', exact: true })).toBeVisible();
		// The queued water log reaches the server exactly once.
		await expect.poll(async () => (await rows(page, 'pendingMutations')).length).toBe(0);
		const { logs } = await (await page.request.get(`/api/water-logs?from=0&to=${Date.now() + 86_400_000}`)).json();
		expect(logs.filter((log: { amountMl: number }) => log.amountMl === 200)).toHaveLength(1);
		expect(errors).toEqual([]);
	} finally {
		docker('rm', '-f', id);
		docker('volume', 'rm', volume);
	}
});
