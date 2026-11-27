<script lang="ts" module>
	export type Bar = { key: string; label: string; title: string; value: number; recorded: boolean; disabled?: boolean; sub?: string };
</script>

<script lang="ts">
	// Bar chart for one metric over days or months. A missing record is drawn as an empty dashed
	// slot, never as a short bar, so "nothing logged" cannot be mistaken for "a little".
	import { t } from '#lib/i18n.svelte';

	let { bars, color, format, unit = '', goal = null, goalLabel = '', onselect }: {
		bars: Bar[];
		color: string;
		format: (value: number) => string;
		/** Appended to values in labels read by screen readers and tooltips. */
		unit?: string;
		goal?: number | null;
		goalLabel?: string;
		onselect?: (key: string) => void;
	} = $props();

	function niceCeil(value: number): number {
		if (value <= 0) return 1;
		const magnitude = 10 ** Math.floor(Math.log10(value));
		const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude >= value) ?? 10;
		return step * magnitude;
	}

	const scaleMax = $derived(niceCeil(Math.max(goal ?? 0, ...bars.filter(b => b.recorded).map(b => b.value), 0)));
	const goalPct = $derived(goal && goal > 0 ? (goal / scaleMax) * 100 : null);
	const dense = $derived(bars.length > 14);
</script>

<div class="chart">
	<div class="plot">
		<span class="tick top">{format(scaleMax)}</span>
		<span class="tick bottom">0</span>
		<div class="grid" style="bottom: 100%"></div>
		<div class="grid" style="bottom: 50%"></div>
		<div class="grid base"></div>
		{#if goalPct !== null}
			<div class="goal" style="bottom: {Math.min(goalPct, 100)}%; border-color: {color}">
				<span style="color: {color}">{goalLabel} {format(goal!)}</span>
			</div>
		{/if}
		<div class="bars" style="gap: {dense ? 2 : 6}px">
			{#each bars as bar (bar.key)}
				{#if bar.disabled}
					<span class="slot"></span>
				{:else}
					<button
						class="slot"
						onclick={() => onselect?.(bar.key)}
						aria-label="{bar.title}: {bar.recorded ? `${format(bar.value)} ${unit}`.trim() : t.history_no_record}"
						title="{bar.title}: {bar.recorded ? `${format(bar.value)} ${unit}`.trim() : t.history_no_record}"
					>
						{#if bar.recorded}
							<span class="bar" style="height: max(2px, {(bar.value / scaleMax) * 100}%); background: {color}; border-radius: {dense ? 2 : 4}px"></span>
						{:else}
							<span class="empty" style="border-radius: {dense ? 2 : 4}px"></span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>
	</div>
	<div class="labels" style="gap: {dense ? 2 : 6}px">
		{#each bars as bar (bar.key)}
			<span>{bar.label}{#if bar.sub}<small>{bar.sub}</small>{/if}</span>
		{/each}
	</div>
</div>

<style>
	.chart { padding-left: 34px; }
	.plot { position: relative; height: 120px; }
	.tick {
		position: absolute; left: -34px; width: 30px; text-align: right;
		font-size: 10px; line-height: 1; color: var(--color-on-surface-variant); font-variant-numeric: tabular-nums;
		white-space: nowrap; overflow: hidden;
	}
	.tick.top { top: -5px; }
	.tick.bottom { bottom: -5px; }
	.grid { position: absolute; left: 0; right: 0; height: 0; border-top: 1px solid var(--color-on-surface-variant); opacity: 0.12; }
	.grid.base { bottom: 0; opacity: 0.3; }
	.goal { position: absolute; left: 0; right: 0; height: 0; border-top: 1.5px dashed; z-index: 1; pointer-events: none; }
	.goal span {
		position: absolute; right: 0; bottom: 2px; font-size: 10px; font-weight: 600; line-height: 1;
		padding: 1px 4px; border-radius: 4px; background: var(--bubble-container-bg); font-variant-numeric: tabular-nums;
	}
	.bars { position: absolute; inset: 0; display: flex; align-items: flex-end; }
	.slot { flex: 1; height: 100%; display: flex; align-items: flex-end; min-width: 0; padding: 0; border: 0; background: none; }
	button.slot:active { opacity: 0.6; }
	button.slot:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; border-radius: 4px; }
	.bar { width: 100%; display: block; }
	.empty { width: 100%; height: 100%; display: block; border: 1px dashed var(--color-on-surface-variant); opacity: 0.28; }
	.labels { display: flex; margin-top: 6px; }
	.labels small { display: block; font-size: 9px; opacity: 0.75; }
	.labels span {
		flex: 1; min-width: 0; text-align: center; font-size: 10px; line-height: 1.2;
		color: var(--color-on-surface-variant); font-variant-numeric: tabular-nums; overflow: visible; white-space: nowrap;
	}
</style>
