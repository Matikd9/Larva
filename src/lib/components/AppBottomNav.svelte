<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t } from '#lib/i18n.svelte';
	import { userSettings } from '#lib/userSettings.svelte';
	import FabWithShortcuts from './FabWithShortcuts.svelte';

	let {
		activeTab,
		onFabTap = null,
		fabLabel = '',
		showFab = true,
		fabVariant = 'add',
		fabColor = 'var(--color-primary)'
	}: {
		activeTab: 'home' | 'history' | 'recipes' | 'none';
		onFabTap?: (() => void) | null;
		fabLabel?: string;
		showFab?: boolean;
		fabVariant?: 'add' | 'edit';
		fabColor?: string;
	} = $props();

	const activeOut = '1.5px solid color-mix(in srgb, var(--color-primary) 55%, transparent)';
</script>

<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto flex justify-center px-6 pointer-events-none"
     style="bottom: calc(-1 * env(safe-area-inset-bottom, 0px)); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px); background: linear-gradient(to top, var(--color-bg) 40%, transparent)">
	<div class="flex items-center gap-3 pointer-events-auto">

		<!-- Left pill -->
		<div class="flex items-center rounded-full gap-0.5" style="height: 52px; padding-left: 1.5px; padding-right: 1.5px; background-color: color-mix(in srgb, var(--color-bg) 60%, transparent); border: 1px solid var(--bubble-interactive-border); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px)"
		>

			<!-- Nutrition (home) -->
			<button
				onclick={() => goto('/')}
				class="flex items-center rounded-full transition-all duration-200 active:opacity-70 select-none {activeTab === 'home' ? 'gap-2 px-4 h-full' : 'h-11 w-11 justify-center'}"
				style="background-color: transparent; {activeTab === 'home' ? `outline: ${activeOut}` : ''}"
				aria-label={t.nutrition_label}
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
				     stroke={activeTab === 'home' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 6.5c-1.5-2.5-6-2.6-7.4 1-1.6 4 1.2 11 4.4 12.2 1.1.4 2-.3 3-.3s1.9.7 3 .3c3.2-1.2 6-8.2 4.4-12.2-1.4-3.6-5.9-3.5-7.4-1Z"/>
					<path d="M12 6.5c0-2 1-3.5 3-4"/>
				</svg>
				{#if activeTab === 'home'}
					<span class="text-sm font-medium whitespace-nowrap" style="color: var(--color-primary)">{t.nutrition_label}</span>
				{/if}
			</button>

			<!-- History -->
			<button
				onclick={() => goto('/tracker')}
				class="flex items-center rounded-full transition-all duration-200 active:opacity-70 select-none {activeTab === 'history' ? 'gap-2 px-4 h-full' : 'h-11 w-11 justify-center'}"
				style="background-color: transparent; {activeTab === 'history' ? `outline: ${activeOut}` : ''}"
				aria-label={t.supplement_tab_history}
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
				     stroke={activeTab === 'history' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>
				</svg>
				{#if activeTab === 'history'}
					<span class="text-sm font-medium whitespace-nowrap" style="color: var(--color-primary)">{t.supplement_tab_history}</span>
				{/if}
			</button>

			<!-- Recipes -->
			{#if userSettings.showRecipes}
				<button
					onclick={() => {
					if (activeTab === 'recipes' && page.url.pathname === '/rezepte') {
						const isMealplan = page.url.searchParams.get('tab') === 'mealplan';
						goto(isMealplan ? '/rezepte' : '/rezepte?tab=mealplan', { reset: false });
					} else {
						goto('/rezepte');
					}
				}}
					class="flex items-center rounded-full transition-all duration-200 active:opacity-70 select-none {activeTab === 'recipes' ? 'gap-2 px-4 h-full' : 'h-11 w-11 justify-center'}"
					style="background-color: transparent; {activeTab === 'recipes' ? `outline: ${activeOut}` : ''}"
					aria-label={t.nav_recipes}
				>
					<svg width="23" height="23" viewBox="0 0 24 24" fill="none"
					     stroke={activeTab === 'recipes' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
					</svg>
					{#if activeTab === 'recipes'}
						<span class="text-sm font-medium whitespace-nowrap"
						      style="color: var(--color-primary)">{t.nav_recipes}</span>
					{/if}
				</button>
			{/if}
		</div>

		<!-- FAB -->
		{#if showFab && onFabTap}
			{#if fabVariant === 'edit'}
				<button
					onclick={onFabTap}
					class="rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
					style="width: 48px; height: 48px; background-color: {fabColor}"
					aria-label={fabLabel}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
			{:else}
				<FabWithShortcuts onTap={onFabTap} label={fabLabel} color={fabColor} />
			{/if}
		{/if}

	</div>
</div>
