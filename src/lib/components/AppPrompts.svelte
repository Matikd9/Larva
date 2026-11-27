<script lang="ts">
	// Install banner (browser only) and the one-time push permission prompt (installed app only).
	// Moved unchanged from the former shopping-list home screen.
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n.svelte';
	import * as publicEnv from '$app/env/public';
	import PwaInstallModal from './PwaInstallModal.svelte';

	let { installPrompt = $bindable(null) }: { installPrompt?: any } = $props();

	const PUBLIC_VAPID_KEY = publicEnv.PUBLIC_VAPID_PUBLIC_KEY ?? '';
	const PUSH_PROMPT_KEY = 'groly_push_prompt_dismissed';
	const INSTALL_BANNER_KEY = 'groly_install_banner_dismissed';

	let showPushPrompt = $state(false);
	let pushPromptLoading = $state(false);
	let showInstallBanner = $state(false);
	let showInstallModal = $state(false);

	function isPWA(): boolean {
		return window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;
	}

	function dismissInstallBanner() {
		localStorage.setItem(INSTALL_BANNER_KEY, '1');
		showInstallBanner = false;
	}

	async function checkPushPrompt() {
		if (!isPWA() || localStorage.getItem(PUSH_PROMPT_KEY)) return;
		if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
		if (Notification.permission !== 'default') return;
		// Small delay so the page settles first
		await new Promise(r => setTimeout(r, 1500));
		showPushPrompt = true;
	}

	function dismissPushPrompt() {
		localStorage.setItem(PUSH_PROMPT_KEY, '1');
		showPushPrompt = false;
	}

	function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = atob(base64);
		const buffer = new ArrayBuffer(rawData.length);
		const view = new Uint8Array(buffer);
		for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
		return view;
	}

	async function acceptPushPrompt() {
		if (!PUBLIC_VAPID_KEY) { dismissPushPrompt(); return; }
		pushPromptLoading = true;
		try {
			// iOS: requestPermission first, while the user-gesture context is still active
			const perm = await Notification.requestPermission();
			if (perm === 'granted') {
				const reg = await navigator.serviceWorker.ready;
				const sub = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
				});
				const json = sub.toJSON();
				await fetch('/api/push/subscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
				});
			}
		} catch { /* ignore */ }
		pushPromptLoading = false;
		dismissPushPrompt();
	}

	onMount(() => {
		if (!isPWA() && !localStorage.getItem(INSTALL_BANNER_KEY)) showInstallBanner = true;
		void checkPushPrompt();
		const handleBeforeInstall = (e: Event) => {
			e.preventDefault();
			installPrompt = e;
		};
		window.addEventListener('beforeinstallprompt', handleBeforeInstall);
		return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
	});
</script>

{#if showInstallBanner}
	<div class="flex items-center gap-3 px-3.5 py-2.5 mt-3 rounded-2xl"
	     style="background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-container)); outline: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)">
		<div class="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
		     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="5" y="2" width="14" height="20" rx="2"/>
				<polyline points="8 10 12 14 16 10"/>
				<line x1="12" y1="14" x2="12" y2="6"/>
			</svg>
		</div>
		<p class="flex-1 text-xs leading-snug" style="color: var(--color-on-surface-variant)">{t.install_banner_text}</p>
		<button
			onclick={() => showInstallModal = true}
			class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center active:opacity-60"
			style="background-color: var(--color-primary); color: var(--color-on-primary)"
			aria-label={t.a11y_install_guide}
		>
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="8" x2="12" y2="8"/>
				<path d="M12 12v5"/>
			</svg>
		</button>
		<button
			onclick={dismissInstallBanner}
			class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center active:opacity-60"
			style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
			aria-label={t.close}
		>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>
	</div>
{/if}

{#if showInstallModal}
	<PwaInstallModal onClose={() => showInstallModal = false} deferredPrompt={installPrompt} />
{/if}

{#if showPushPrompt}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={dismissPushPrompt}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-10 pt-4"
	     style="background-color: var(--modal-bg)">
		<div class="flex justify-center mb-5">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
		     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
			<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
				<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
			</svg>
		</div>
		<h2 class="text-lg font-bold mb-1" style="color: var(--color-on-surface)">{t.push_prompt_title}</h2>
		<p class="text-sm mb-6" style="color: var(--color-on-surface-variant)">{t.push_prompt_body}</p>
		<div class="flex gap-3">
			<button
				onclick={dismissPushPrompt}
				class="flex-1 py-3.5 rounded-full text-sm font-semibold"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>{t.push_prompt_decline}</button>
			<button
				onclick={acceptPushPrompt}
				disabled={pushPromptLoading}
				class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-60"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{#if pushPromptLoading}
					<span class="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
				{:else}
					{t.push_prompt_accept}
				{/if}
			</button>
		</div>
	</div>
{/if}
