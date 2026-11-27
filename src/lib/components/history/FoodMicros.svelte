<script lang="ts">
	// Micronutrients from food for a month or year. Values are lower bounds: only foods that report a
	// nutrient count, and each row says how much of the logged kcal that covers.
	import { t, currentLang, history_kcal_coverage } from '#lib/i18n.svelte';
	import { ESSENTIAL_MICROS_META } from '#lib/micronutrients';
	import type { FoodMicros } from './historyData';

	let { data }: { data: FoodMicros } = $props();

	const locale = $derived(currentLang() === 'en' ? 'en-US' : 'de-DE');
	const rows = $derived(ESSENTIAL_MICROS_META.map(meta => {
		const entry = data.micros[meta.key];
		return {
			meta,
			perDay: entry && data.loggedDays > 0 ? entry.total / data.loggedDays : null,
			coverage: entry && data.kcal > 0 ? Math.round((entry.coveredKcal / data.kcal) * 100) : 0
		};
	}));
	const withData = $derived(rows.filter(row => row.perDay !== null));
	const withoutData = $derived(rows.filter(row => row.perDay === null));
	const fmt = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: value < 10 ? 1 : 0 });
</script>

<section class="history-section">
	<h2 class="history-section-header history-section-title">{t.history_food_micros_title}</h2>
	<div class="history-section-content">
		{#each withData as row (row.meta.key)}
			<div class="row">
				<span class="name">{row.meta.label}</span>
				<span class="value">≥ {fmt(row.perDay!)} {row.meta.unit}</span>
				<span class="coverage" aria-label={history_kcal_coverage(row.coverage)}>
					<span class="track"><span style="width: {row.coverage}%; background: {row.meta.color}"></span></span>
					<span class="pct">{history_kcal_coverage(row.coverage)}</span>
				</span>
			</div>
		{/each}
		{#if withoutData.length > 0}
			<p class="missing">{t.history_micro_no_data}: {withoutData.map(row => row.meta.label).join(', ')}</p>
		{/if}
		<p class="note">{t.history_food_micros_note}</p>
	</div>
</section>

<style>
	h2.history-section-header { margin: 0; }
	.row { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 6px 0; }
	.name { font-size: 14px; color: var(--color-on-surface); }
	.value { font-size: 14px; font-weight: 600; color: var(--color-on-surface); font-variant-numeric: tabular-nums; text-align: right; }
	.coverage { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; }
	.track { flex: 1; height: 4px; border-radius: 2px; overflow: hidden; background: var(--color-surface-high); }
	.track span { display: block; height: 100%; }
	.pct { font-size: 11px; color: var(--color-on-surface-variant); font-variant-numeric: tabular-nums; white-space: nowrap; }
	.missing, .note { margin-top: 10px; font-size: 12px; line-height: 1.45; color: var(--color-on-surface-variant); }
</style>
