import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';

vi.mock('#lib/db', async () => {
	const { default: Database } = await import('better-sqlite3');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const schema = await import('#lib/db/schema');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './src/lib/db/migrations' });
	return { db, sqlite };
});
vi.mock('#lib/server/pushNotifications', () => ({ sendPushToUser: vi.fn(), getUserLang: () => 'de' }));
vi.mock('#lib/server/startup', () => ({ init: async () => {}, startupStatus: () => 'ready' }));

import { sqlite, db } from '#lib/db';
import { recipes, recipeIngredients, mealPlanEntries, sessions } from '#lib/db/schema';
import { bootstrapAdmin, changePassword, createUser, getSession, hashLegacySessions, login, sessionKey } from '#lib/auth';
import { consumeInvite, createInvite, validateInvite } from '#lib/auth/invites';
import { validatePasswordRule } from '#lib/password';
import * as loginRoute from '../../routes/api/auth/login/+server';
import * as logoutRoute from '../../routes/api/auth/logout/+server';
import * as planner from '../../routes/api/meal-plan/+server';
import * as planEntry from '../../routes/api/meal-plan/[id]/+server';
import * as shareRoute from '../../routes/api/recipes/[id]/share/+server';
import * as acceptShare from '../../routes/api/recipes/shares/[id]/+server';
import * as subscribeRoute from '../../routes/api/push/subscribe/+server';
import { handle } from '../../hooks.server';

function event(session: string | null, url: string, body?: unknown, params: Record<string, string> = {}, cookies = new Map<string, string>(), ip = randomUUID()) {
	if (session) cookies.set('session', session);
	return {
		params, url: new URL(url, 'http://localhost'),
		request: new Request(new URL(url, 'http://localhost'), body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
		cookies: { get: (key: string) => cookies.get(key), set: (key: string, value: string) => cookies.set(key, value), delete: (key: string) => cookies.delete(key) },
		getClientAddress: () => ip
	} as never;
}

beforeEach(() => { sqlite.exec('DELETE FROM users'); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('account security', () => {
	it('rejects an old tab sending requests under the browser new account cookie', async () => {
		const alice = await createUser('alice', 'Password123');
		await createUser('bob', 'Password123');
		const b = (await login('bob', 'Password123'))!.sessionId;
		const value = event(b, '/api/water-logs') as unknown as { request: Request; locals: Record<string, unknown> };
		value.request = new Request('http://localhost/api/water-logs', { headers: { 'X-Groly-User': alice } });
		value.locals = {};
		const resolve = vi.fn(async () => Response.json({ ok: true }));
		const response = await handle({ event: value as never, resolve });
		expect(response.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('uses one login bucket for every whitespace alias and rejects invalid input', async () => {
		await createUser('alice', 'Password123');
		const ip = randomUUID();
		for (let n = 0; n < 10; n++) {
			const response = await loginRoute.POST(event(null, '/api/auth/login', { username: 'alice' + ' '.repeat(n), password: 'wrong' }, {}, new Map(), ip));
			expect(response.status).toBe(401);
		}
		expect((await loginRoute.POST(event(null, '/api/auth/login', { username: ' alice ', password: 'Password123' }, {}, new Map(), ip))).status).toBe(429);
		expect((await loginRoute.POST(event(null, '/api/auth/login', { username: {}, password: [] }))).status).toBe(400);
	});

	it('validates the actual stored password while retaining legacy login trimming', async () => {
		expect(validatePasswordRule('A1      ')).toBe('too_short');
		expect(validatePasswordRule(' Password123 ')).toBeNull();
		await createUser('alice', 'Password123');
		expect(await login(' alice ', ' Password123 ')).not.toBeNull();
		await createUser('carol', ' Spaced-Password1 '); // created and checked with the same trimming
		expect(await login('carol', 'Spaced-Password1')).not.toBeNull();
		expect(await login('nobody', 'Password123')).toBeNull();
	});

	it('stores sessions only as hashes and upgrades sessions created before hashing', async () => {
		const alice = await createUser('alice', 'Password123');
		const cookie = (await login('alice', 'Password123'))!.sessionId;
		const stored = db.select().from(sessions).all().map(row => row.id);
		expect(stored).toEqual([sessionKey(cookie)]);
		expect(getSession(cookie)?.id).toBe(alice);
		const legacyCookie = 'legacy-session-cookie-value-1234';
		db.insert(sessions).values({ id: legacyCookie, userId: alice, expiresAt: Math.floor(Date.now() / 1000) + 3600, createdAt: 0 }).run();
		expect(getSession(legacyCookie)).toBeNull(); // raw values are never accepted as keys
		hashLegacySessions();
		hashLegacySessions(); // idempotent
		expect(getSession(legacyCookie)?.id).toBe(alice);
		expect(db.select().from(sessions).all().some(row => row.id === legacyCookie)).toBe(false);
	});

	it('keeps only the changing device session and consumes outstanding reset links', async () => {
		const user = await createUser('alice', 'Password123');
		const current = (await login('alice', 'Password123'))!.sessionId;
		const other = (await login('alice', 'Password123'))!.sessionId;
		const reset = createInvite(user, 'reset');
		sqlite.prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, auth, p256dh, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('current-device', user, 'https://push.example/current', 'fixture', 'fixture', 1);
		sqlite.prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, auth, p256dh, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('other-device', user, 'https://push.example/other', 'fixture', 'fixture', 1);
		changePassword(user, 'NewPassword123', current, 'current-device');
		expect(getSession(current)?.id).toBe(user);
		expect(getSession(other)).toBeNull();
		expect(validateInvite(reset).status).toBe('used');
		expect(sqlite.prepare('SELECT id FROM push_subscriptions WHERE user_id = ?').all(user)).toEqual([{ id: 'current-device' }]);
		const nextReset = createInvite(user, 'reset');
		const result = consumeInvite(nextReset, 'ResetPassword123');
		expect('sessionId' in result).toBe(true);
		expect(getSession(current)).toBeNull();
		expect(sqlite.prepare('SELECT id FROM push_subscriptions WHERE user_id = ?').all(user)).toEqual([]);
		if ('sessionId' in result) expect(getSession(result.sessionId)?.id).toBe(user);
		expect(consumeInvite(nextReset, 'AgainPassword123')).toEqual({ error: 'used' });
	});

	it('requires an explicit first-install password without changing existing installations', async () => {
		vi.stubEnv('ADMIN_PASSWORD', 'changeme123');
		expect(() => bootstrapAdmin()).toThrow();
		await createUser('alice', 'Password123', 'admin');
		vi.stubEnv('ADMIN_PASSWORD', '');
		expect(() => bootstrapAdmin()).not.toThrow();
		expect(await login('alice', 'Password123')).not.toBeNull();
	});

	it('removes only the logging-out device push subscription', async () => {
		const user = await createUser('alice', 'Password123');
		const session = (await login('alice', 'Password123'))!.sessionId;
		const key = createECDH('prime256v1'); key.generateKeys();
		const keys = { auth: randomBytes(16).toString('base64url'), p256dh: key.getPublicKey().toString('base64url') };
		const first = new Map<string, string>(), second = new Map<string, string>();
		expect((await subscribeRoute.POST(event(session, '/api/push/subscribe', { endpoint: 'https://push.example.com/device1', keys }, {}, first))).status).toBe(201);
		expect((await subscribeRoute.POST(event(session, '/api/push/subscribe', { endpoint: 'https://push.example.com/device2', keys }, {}, second))).status).toBe(201);
		expect((await subscribeRoute.POST(event(session, '/api/push/subscribe', { endpoint: 'https://127.0.0.1/internal', keys }))).status).toBe(400);
		await logoutRoute.POST(event(session, '/api/auth/logout', {}, {}, first));
		const rows = sqlite.prepare('SELECT endpoint FROM push_subscriptions WHERE user_id = ?').all(user);
		expect(rows).toEqual([{ endpoint: 'https://push.example.com/device2' }]);
	});
});

describe('recipe sharing and meal-plan ownership', () => {
	it('blocks a foreign original but allows its accepted copy in the meal plan', async () => {
		const alice = await createUser('alice', 'Password123');
		const bob = await createUser('bob', 'Password123');
		const a = (await login('alice', 'Password123'))!.sessionId;
		const b = (await login('bob', 'Password123'))!.sessionId;
		db.insert(recipes).values({ id: 'private-recipe', userId: alice, title: 'Shared soup', servings: 2, createdAt: Date.now(), updatedAt: Date.now() }).run();
		db.insert(recipeIngredients).values({ id: 'ingredient', recipeId: 'private-recipe', name: 'Carrots', amount: '100', unit: 'g', sortOrder: 0 }).run();
		expect((await planner.PUT(event(b, '/api/meal-plan', { date: '2026-10-17', recipeId: 'private-recipe', servings: 2 }))).status).toBe(404);
		const sent = await shareRoute.POST(event(a, '/api/recipes/private-recipe/share', { username: 'bob' }, { id: 'private-recipe' }));
		expect(sent.status).toBe(201);
		const share = sqlite.prepare('SELECT id FROM recipe_shares WHERE receiver_id = ?').get(bob) as { id: string };
		const accepted = await acceptShare.PUT(event(b, '/api/recipes/shares/' + share.id, { action: 'accept' }, { id: share.id }));
		const { recipeId } = await accepted.json();
		expect(recipeId).not.toBe('private-recipe');
		expect((await planner.PUT(event(b, '/api/meal-plan', { date: '2026-10-17', recipeId, servings: 2 }))).status).toBe(200);
		const entry = sqlite.prepare('SELECT id FROM meal_plan_entries WHERE user_id = ?').get(bob) as { id: string };
		expect((await planEntry.PATCH(event(b, '/api/meal-plan/' + entry.id, { recipeId: 'private-recipe' }, { id: entry.id }))).status).toBe(404);
		// Old invalid references are harmless even if they existed before this fix.
		db.insert(mealPlanEntries).values({ id: 'legacy-invalid', userId: bob, date: '2026-10-18', recipeId: 'private-recipe', servings: 2, createdAt: 1, updatedAt: 1 }).run();
		const entries = await (await planner.GET(event(b, '/api/meal-plan?from=2026-10-18&to=2026-10-18'))).json();
		expect(entries[0].recipeTitle).toBeNull();
	});
});
