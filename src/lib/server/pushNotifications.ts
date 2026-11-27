import webpush from 'web-push';
import { db } from '#lib/db';
import { pushSubscriptions } from '#lib/db/schema';
import { eq } from 'drizzle-orm';
import * as env from '$app/env/private';
import { publicPushAgent } from './publicNetwork';

async function sendNotification(sub: { userId: string; endpoint: string; auth: string; p256dh: string }, payload: string) {
	const agent = await publicPushAgent(sub.endpoint);
	try {
		return await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, JSON.stringify({ ...JSON.parse(payload), userId: sub.userId }), { agent, timeout: 10_000 });
	} finally { agent.destroy(); }
}

type Lang = 'de' | 'en';

export function getUserLang(settings: string | null): Lang {
	try {
		if (settings && JSON.parse(settings)?.lang === 'en') return 'en';
	} catch { /* use default */ }
	return 'de';
}

let initialized = false;

function init() {
	if (initialized) return;
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
	webpush.setVapidDetails(
		env.VAPID_SUBJECT ?? 'mailto:admin@groly.local',
		env.VAPID_PUBLIC_KEY,
		env.VAPID_PRIVATE_KEY
	);
	initialized = true;
}

export async function sendPushToUser(
	userId: string,
	payload: { title: string; body: string; url?: string; tag?: string }
): Promise<'sent' | 'no_subscription' | 'failed'> {
	init();
	if (!initialized) return 'failed';

	const subs = db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId))
		.all();

	if (subs.length === 0) return 'no_subscription';

	const payloadStr = JSON.stringify(payload);
	const staleEndpoints: string[] = [];
	let anySuccess = false;

	await Promise.allSettled(
		subs.map(async (sub) => {
			try {
				await sendNotification(sub, payloadStr);
				anySuccess = true;
			} catch (err: unknown) {
				const status = (err as { statusCode?: number })?.statusCode;
				if (status === 410 || status === 404) {
					staleEndpoints.push(sub.endpoint);
				}
			}
		})
	);

	for (const endpoint of staleEndpoints) {
		db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
	}

	return anySuccess ? 'sent' : 'failed';
}
