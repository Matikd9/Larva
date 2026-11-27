<script lang="ts">
	import type { ShortcutAction } from '#lib/userSettingsTypes';
	let { action, size = 20, color = 'var(--color-on-surface-variant)' }: { action: ShortcutAction; size?: number; color?: string } = $props();
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	{#if action === 'log-meal'}<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
	{:else if action === 'log-supplement'}<rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" />
	{:else if action === 'log-water'}<path d="M12 2.7 6.3 8.9a8 8 0 1 0 11.4 0Z" />
	{:else if action === 'log-caffeine'}<path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 2v2M10 2v2M14 2v2" />
	{:else if action === 'log-mood'}<circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
	{:else if action === 'log-meditation'}<circle cx="12" cy="5" r="2" /><path d="M12 7v6M5 21l3-6h8l3 6M4 13h16" />
	{:else}<path d="M3 12h4l3-8 4 16 3-8h4" />{/if}
</svg>
