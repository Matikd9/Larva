import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { seedUpgradeFixture } from '../../scripts/docker-fixtures.mjs';
import de from '../../messages/de.json' with { type: 'json' };
import en from '../../messages/en.json' with { type: 'json' };

const image = process.env.GROLY_TEST_IMAGE;
test.skip(!image, 'Set GROLY_TEST_IMAGE to a locally built production image');
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();

test('cooking stays readable and amounts scale with servings, including fractions and ranges', async ({ page, request }) => {
	const id = `groly-recipes-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	try {
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', id, '-p', '127.0.0.1:3100:3000', '--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'ADMIN_USERNAME=recipes-bootstrap', '-e', 'ADMIN_PASSWORD=Groly-recipes-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100', '-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', id, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page.getByText(de.nutrition_label, { exact: true }).first()).toBeVisible();
		const created = await page.request.post('/api/recipes', { data: { title: 'Kürbissuppe', servings: 2, ingredients: [
			{ name: 'Hokkaidokürbis', amount: '1/2', unit: 'kg' },
			{ name: 'Zwiebeln', amount: '1-2', unit: null },
			{ name: 'Salz', amount: null, unit: null }
		], steps: [{ text: 'Alle Zutaten bereitstellen.' }] } });
		expect(created.status()).toBe(201);
		await page.goto(`/rezepte/${(await created.json()).id}`);
		const cooking = page.locator('[data-recipe-ingredients]');
		await expect(cooking.locator('li')).toHaveCount(3);
		await expect(cooking.locator('input, button')).toHaveCount(0);
		await expect(cooking.locator('li').first()).toContainText('0,5 kg');
		// Doubling 2 → 4 servings: "1/2" (shown as 0,5 kg) becomes "1 kg" and the range "1-2" becomes "2-4".
		await page.getByRole('button', { name: de.a11y_increase_servings, exact: true }).click();
		await page.getByRole('button', { name: de.a11y_increase_servings, exact: true }).click();
		await expect(cooking.locator('li').nth(0)).toContainText('1 kg');
		await expect(cooking.locator('li').nth(1)).toContainText('2-4');
		await expect(cooking.locator('li').nth(2)).toContainText('Salz');
		expect(errors).toEqual([]);
	} finally {
		docker('rm', '-f', id);
		docker('volume', 'rm', volume);
	}
});

test('one recipe card keeps favorites at the bottom and shows concise metadata in both languages', async ({ page, request }) => {
	const id = `groly-overview-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	try {
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', id, '-p', '127.0.0.1:3100:3000', '--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'ADMIN_USERNAME=overview-bootstrap', '-e', 'ADMIN_PASSWORD=Groly-overview-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100', '-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', id, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page.getByText(de.nutrition_label, { exact: true }).first()).toBeVisible();
		async function updateRecipe(recipeId: string, changes: Record<string, unknown>) {
			const recipe = await (await page.request.get(`/api/recipes/${recipeId}`)).json();
			expect((await page.request.put(`/api/recipes/${recipeId}`, { data: { ...recipe, ...changes } })).ok()).toBe(true);
		}
		async function createRecipe(values: Record<string, unknown> & { title: string }) {
			const response = await page.request.post('/api/recipes', { data: { servings: 2, ingredients: [], steps: [], ...values } });
			expect(response.status()).toBe(201);
			const recipeId = (await response.json()).id as string;
			await updateRecipe(recipeId, values);
			return recipeId;
		}
		const onePot = await createRecipe({ title: 'One-Pot-Spätzle mit Hähnchen von Henglein', description: 'lecker', prepTime: 15, cookTime: 30, rating: 4, tags: ['chillig', 'schnell', 'zusätzlich mit einer besonders ausführlichen Beschreibung im Tag'] });
		const chili = await createRecipe({ title: 'Chili con Carne – das beste Rezept', description: 'Importierter Beschreibungstext', cookTime: 45, rating: 3, isFavorite: true });
		const noInfo = await createRecipe({ title: 'Ohne Angaben', description: 'lecker' });
		const ratingOnly = await createRecipe({ title: 'Nur bewertet', rating: 5, isFavorite: true });
		await page.goto('/rezepte');
		const card = page.locator('[data-recipe-card]');
		await expect(card).toHaveCount(1);
		await expect(card.locator('[data-recipe-id]')).toHaveCount(5);
		await page.getByRole('button', { name: de.recipes_sort_label, exact: true }).click();
		await page.getByRole('button', { name: de.recipes_sort_title, exact: true }).click();
		const expectedOrder = ['upgrade-recipe', noInfo, onePot, chili, ratingOnly];
		expect(await card.locator('[data-recipe-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-recipe-id')))).toEqual(expectedOrder);
		await expect(card.locator('h3')).toHaveText([de.recipes_favorites]);
		expect(await card.locator('h3').evaluate(heading => {
			const title = heading.parentElement!.querySelector('h2')!;
			const section = getComputedStyle(heading), main = getComputedStyle(title);
			return section.color === main.color && section.fontSize === main.fontSize && section.fontWeight === main.fontWeight;
		})).toBe(true);
		await expect(card).not.toContainText('lecker');
		await expect(card).not.toContainText('Importierter Beschreibungstext');
		await expect(card.locator(`[data-recipe-id="${onePot}"] [data-recipe-meta]`)).toContainText('4 · 45 Min · chillig · schnell');
		await expect(card.locator('[data-recipe-id="upgrade-recipe"] [data-recipe-meta]')).toHaveText('Familie');
		await expect(card.locator(`[data-recipe-id="${ratingOnly}"] [data-recipe-meta]`)).toHaveText('5');
		await expect(card.locator(`[data-recipe-id="${noInfo}"] [data-recipe-meta]`)).toHaveCount(0);
		// Search, tag filtering and the saved sort still operate across both groups.
		await page.getByRole('button', { name: de.a11y_search, exact: true }).click();
		await page.getByPlaceholder(de.recipes_search_placeholder).fill('Chili');
		await expect(card.locator('[data-recipe-id]')).toHaveCount(1);
		await expect(card.locator('h3')).toHaveCount(0);
		await page.getByRole('button', { name: de.a11y_close_search, exact: true }).click();
		await page.getByRole('button', { name: de.a11y_search, exact: true }).click();
		await page.getByRole('button', { name: 'chillig', exact: true }).click();
		await expect(card.locator('[data-recipe-id]')).toHaveCount(1);
		await expect(card.locator(`[data-recipe-id="${onePot}"]`)).toBeVisible();
		await page.getByRole('button', { name: de.a11y_close_search, exact: true }).click();
		for (const [lang, messages] of [['de', de], ['en', en]] as const) {
			expect((await page.request.patch('/api/users/me', { data: { settings: { lang } } })).ok()).toBe(true);
			await page.reload();
			await expect(card.locator('h3')).toHaveText([messages.recipes_favorites]);
			for (const width of [320, 390]) {
				await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
				const bounds = await card.boundingBox();
				expect(bounds!.y + bounds!.height).toBeGreaterThan((width === 320 ? 568 : 844) - 120);
				const meta = card.locator(`[data-recipe-id="${onePot}"] [data-recipe-meta]`);
				expect(await meta.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
				expect((await meta.boundingBox())!.height).toBeLessThan(20);
				for (const theme of ['light', 'dark']) {
					await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
					await page.screenshot({ animations: 'disabled', path: `test-results/${test.info().project.name}-recipes-${lang}-${theme}-${width}.png` });
				}
			}
		}
		// The original description is still present in the detail view.
		await card.locator(`[data-recipe-id="${onePot}"]`).click();
		await expect(page.getByText('lecker', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: en.a11y_back, exact: true }).click();
		await expect(card.locator('[data-recipe-id]')).toHaveCount(5);
		for (const recipeId of [chili, ratingOnly]) await updateRecipe(recipeId, { isFavorite: false });
		await page.reload();
		await expect(card.locator('[data-recipe-id]')).toHaveCount(5);
		await expect(card.locator('h3')).toHaveCount(0);
		for (const recipeId of expectedOrder) await updateRecipe(recipeId, { isFavorite: true });
		await page.reload();
		await expect(card.locator('[data-recipe-id]')).toHaveCount(5);
		await expect(card.locator('h3')).toHaveCount(0);
		for (const recipeId of expectedOrder) expect((await page.request.delete(`/api/recipes/${recipeId}`, { headers: { Origin: 'http://127.0.0.1:3100' } })).ok()).toBe(true);
		await page.reload();
		await expect(card).toHaveCount(0);
		await expect(page.getByText(en.recipes_empty, { exact: true })).toBeVisible();
		expect(errors).toEqual([]);
	} finally {
		docker('rm', '-f', id);
		docker('volume', 'rm', volume);
	}
});
