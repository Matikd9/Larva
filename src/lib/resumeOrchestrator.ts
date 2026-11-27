// Push clicks arrive through the persistent IDB mailbox. Mount, foreground,
// focus/pageshow and the worker's nudge all check it; polling also covers delayed
// writes after iOS suspension.

import { consumePendingDeeplink, setPendingDeeplink } from '#lib/pendingDeeplink';
import { drainPendingMutations } from '#lib/sync/manager';
import { refreshActiveUserSettings } from '#lib/userSettings.svelte';

export function initResumeOrchestrator() {
	if (typeof window === 'undefined') return;

	let navigation = Promise.resolve();
	let mailboxRead: Promise<boolean> | null = null;
	let watching = false;

	// Serialize navigations so a second push target never overtakes the first.
	function navigateTo(url: string) {
		const next = navigation.catch(() => {}).then(async () => {
			if (location.pathname + location.search !== url) {
				const { goto } = await import('$app/navigation');
				await goto(url);
			}
		});
		navigation = next;
		return next;
	}

	function readMailbox(): Promise<boolean> {
		// Foreground and focus often fire together; share the read and its outcome.
		if (mailboxRead) return mailboxRead;
		mailboxRead = (async () => {
			const url = await consumePendingDeeplink();
			if (!url) return false;
			try {
				await navigateTo(url);
			} catch {
				// A failed navigation must not permanently consume the notification.
				await setPendingDeeplink(url);
			}
			void drainPendingMutations();
			return true;
		})().finally(() => { mailboxRead = null; });
		return mailboxRead;
	}

	async function watchMailbox() {
		if (watching) return;
		watching = true;
		try {
			const delays = [250, 250, 250, 250, 500, 500, 1000, 1000, 1000, 1000, 1000];
			for (const delay of delays) {
				await new Promise(resolve => setTimeout(resolve, delay));
				if (await readMailbox()) return;
			}
		} finally {
			watching = false;
		}
	}

	async function tryDeeplinkNow(): Promise<boolean> {
		if (await readMailbox()) return true;
		void watchMailbox();
		return false;
	}

	async function handleResume() {
		if (await tryDeeplinkNow()) return;
		void refreshActiveUserSettings();
	}

	void handleResume();

	let lastResumeAt = 0;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		const now = Date.now();
		if (now - lastResumeAt < 600) return;
		lastResumeAt = now;
		void handleResume();
	});

	window.addEventListener('focus', () => void tryDeeplinkNow());
	window.addEventListener('pageshow', () => void tryDeeplinkNow());
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
			if (event.data?.type === 'deeplink-nudge') void tryDeeplinkNow();
		});
	}
}
