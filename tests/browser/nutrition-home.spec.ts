import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { seedUpgradeFixture } from '../../scripts/docker-fixtures.mjs';
import de from '../../messages/de.json' with { type: 'json' };

const image = process.env.GROLY_TEST_IMAGE;
test.skip(!image, 'Set GROLY_TEST_IMAGE to a locally built production image');
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();

test('nutrition is the home screen with the daily log, history and redirects for old links', async ({ page, request }) => {
	const id = `groly-home-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	try {
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', id, '-p', '127.0.0.1:3100:3000', '--mount', `type=volume,src=${volume},dst=/app/data`,
			'-e', 'ADMIN_USERNAME=home-bootstrap', '-e', 'ADMIN_PASSWORD=Groly-home-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100',
			'-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', id, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();

		// Signing in lands on nutrition: today's seeded meal, then the daily log with its trackers.
		await expect(page).toHaveURL('http://127.0.0.1:3100/');
		await expect(page.getByText(/Haferflocken/).first()).toBeVisible();
		await expect(page.getByText(de.daily_log_title, { exact: true })).toBeVisible();
		await expect(page.getByText(de.water_title, { exact: true }).first()).toBeVisible();
		await expect(page.getByText('Magnesium', { exact: true }).first()).toBeVisible();
		for (const tab of [de.nutrition_label, de.supplement_tab_history, de.nav_recipes]) {
			await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
		}
		await expect(page.getByRole('button', { name: 'Listen', exact: true })).toHaveCount(0);

		// The date picker drives the daily log too: yesterday has no seeded entries.
		await page.getByRole('button', { name: de.nutrition_prev_day, exact: true }).click();
		await expect(page.getByRole('button', { name: de.daily_log_empty, exact: true })).toBeVisible();
		await page.getByRole('button', { name: de.nutrition_jump_today, exact: true }).click();
		await expect(page.getByText('Magnesium', { exact: true }).first()).toBeVisible();

		// The + button opens quick log for every tracker.
		await page.getByRole('button', { name: de.add, exact: true }).last().click();
		await expect(page.getByText(de.water_title, { exact: true }).last()).toBeVisible();
		await page.keyboard.press('Escape');

		// Links from older notifications, shortcuts and installed apps still work.
		await page.goto('/tracker?action=log-water');
		await expect(page).toHaveURL('http://127.0.0.1:3100/');
		await expect(page.getByRole('button', { name: /\+100/ })).toBeVisible();
		await page.goto('/tracker/nutrition');
		await expect(page).toHaveURL('http://127.0.0.1:3100/');

		// History keeps its own tab with statistics and PDF export.
		await page.getByRole('button', { name: de.supplement_tab_history, exact: true }).click();
		await expect(page).toHaveURL('http://127.0.0.1:3100/tracker');
		await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: de.supplement_stats_week, exact: true })).toBeVisible();
		await expect(page.getByText(de.history_tap_day_hint, { exact: false })).toBeVisible();

		// Year: calendar heatmap with "Erfasst" (logging coverage) selected by default.
		await page.getByRole('button', { name: de.history_period_year, exact: true }).click();
		await expect(page.getByRole('radio', { name: de.history_year_coverage, exact: true })).toHaveAttribute('aria-checked', 'true');
		await expect(page.locator('button.cell').first()).toBeVisible();

		// A day in a chart opens the home screen at that date; going back keeps the chosen period.
		await page.getByRole('button', { name: de.supplement_stats_month, exact: true }).click();
		const today = new Date();
		const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
		await page.locator('.bars button').filter({ hasNot: page.locator('.empty') }).last().click();
		await expect(page).toHaveURL(new RegExp(`/\\?date=\\d{4}-\\d{2}-\\d{2}$`));
		expect(new URL(page.url()).searchParams.get('date')! <= todayKey).toBe(true);
		await page.goBack();
		await expect(page.getByRole('button', { name: de.supplement_stats_month, exact: true })).toHaveAttribute('aria-pressed', 'true');
		expect(errors).toEqual([]);
	} finally {
		docker('rm', '-f', id);
		docker('volume', 'rm', volume);
	}
});
