<script lang="ts">
	// History for one week or month: per category a chart, an average with its coverage and,
	// when both periods hold enough logged days, a comparison with the previous period.
	import { t, currentLang, nutrients_show_more, history_days_logged, history_vs_previous, history_no_comparison, history_goal_reached, history_over_limit, history_vs_goal, history_sessions, history_taken_days } from '#lib/i18n.svelte';
	import { userSettings } from '#lib/userSettings.svelte';
	import { todayKey } from '#lib/dates';
	import { computeAdherence, computeTrackerStats, eachDayInRange, type DailyFill, type TrackerStats } from '#lib/trackerStats';
	import { comparePeriods, MIN_COMPARE_DAYS } from '#lib/historyMetrics';
	import type { PeriodRange } from '#lib/historyRange';
	import PeriodChart, { type Bar } from './PeriodChart.svelte';
	import HistorySurface from '../supplements/HistorySurface.svelte';
	import MoodHistoryView from '../supplements/MoodHistoryView.svelte';
	import FoodMicros from './FoodMicros.svelte';
	import { CATEGORY_COLORS, type HistoryData } from './historyData';

	let { period, range, previous, data, goals, onselectday, onMoodReload }: {
		period: 'week' | 'month';
		range: PeriodRange;
		previous: PeriodRange;
		data: HistoryData;
		goals: { kcal: number | null; protein: number | null; fat: number | null; carbs: number | null };
		onselectday: (dateKey: string) => void;
		onMoodReload: () => void;
	} = $props();

	const locale = $derived(currentLang() === 'en' ? 'en-US' : 'de-DE');
	const minDays = $derived(MIN_COMPARE_DAYS[period]);
	const today = todayKey();
	const days = $derived(eachDayInRange(range));

	const fmt = (value: number, digits = 0) => value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
	function signed(value: number, unit: string, digits = 0): string {
		const rounded = Number(Math.abs(value).toFixed(digits));
		return `${rounded === 0 ? '±' : value > 0 ? '+' : '−'}${fmt(rounded, digits)}${unit ? ` ${unit}` : ''}`;
	}

	function bars(stats: TrackerStats): Bar[] {
		return days.map((day, i) => {
			const date = new Date(`${day}T12:00:00`);
			const dayOfMonth = date.getDate();
			return {
				key: day,
				label: period === 'week'
					? date.toLocaleDateString(locale, { weekday: 'narrow' })
					: dayOfMonth === 1 || dayOfMonth % 5 === 0 ? String(dayOfMonth) : '',
				title: date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }),
				value: stats.daily[i],
				recorded: stats.logCounts[i] > 0,
				disabled: day > today
			};
		});
	}

	function statsPair<T>(rows: T[], map: (row: T) => { value: number; loggedAt?: number; date?: string }) {
		const mapped = rows.map(map);
		return { current: computeTrackerStats(mapped, range), previous: computeTrackerStats(mapped, previous) };
	}

	const nutrition = $derived(statsPair(data.mealDays, d => ({ value: d.kcal, date: d.date })));
	const water = $derived(statsPair(data.water, l => ({ value: l.amountMl, loggedAt: l.loggedAt })));
	const caffeine = $derived(statsPair(data.caffeine, l => ({ value: l.caffeineMg, loggedAt: l.loggedAt })));
	const meditation = $derived(statsPair(data.meditation, l => ({ value: l.durationSeconds / 60, loggedAt: l.loggedAt })));
	const mood = $derived(statsPair(data.mood, l => ({ value: l.mood, date: l.date })));

	const macros = $derived.by(() => {
		const logged = data.mealDays.filter(d => d.date >= range.fromKey && d.date <= range.toKey);
		if (logged.length === 0) return null;
		const sum = (key: 'protein' | 'fat' | 'carbs') => logged.reduce((s, d) => s + d[key], 0);
		const [protein, fat, carbs] = [sum('protein'), sum('fat'), sum('carbs')];
		const kcal = protein * 4 + fat * 9 + carbs * 4;
		const pct = (part: number) => (kcal > 0 ? Math.round((part / kcal) * 100) : 0);
		return {
			avg: { protein: protein / logged.length, fat: fat / logged.length, carbs: carbs / logged.length },
			pct: { protein: pct(protein * 4), fat: pct(fat * 9), carbs: kcal > 0 ? 100 - pct(protein * 4) - pct(fat * 9) : 0 }
		};
	});

	const meditationSessions = $derived(data.meditation.filter(l => l.loggedAt >= range.from && l.loggedAt <= range.to));
	const waterGoal = $derived(userSettings.waterGoalMl ?? 2500);
	const caffeineLimit = $derived(userSettings.caffeineLimitMg ?? 400);
	const meditationGoal = $derived(userSettings.meditationDailyGoalMinutes ?? 15);
	const reachedDays = (stats: TrackerStats, test: (value: number) => boolean) => stats.daily.filter((v, i) => stats.logCounts[i] > 0 && test(v)).length;

	const adherence = $derived(computeAdherence(data.supplements, data.schedules, data.supplementLogs, range));
	const nutrientEntries = $derived(Object.values(data.supplementNutrients).sort((a, b) => a.name.localeCompare(b.name)));
	let nutrientsExpanded = $state(false);

	const moodComparison = $derived(comparePeriods(mood.current, mood.previous, minDays));
	const hasData = $derived(nutrition.current.activeDays + water.current.activeDays + caffeine.current.activeDays
		+ meditation.current.activeDays + mood.current.activeDays + adherence.length + nutrientEntries.length > 0);

	function fillColor(fill: DailyFill): string {
		if (fill === 'full') return 'var(--color-primary-dim)';
		if (fill === 'partial') return 'color-mix(in srgb, var(--color-primary-dim) 55%, var(--color-surface-high))';
		if (fill === 'none') return 'var(--color-surface-high)';
		return 'transparent';
	}

	function formatNutrient(value: number, unit: string): string {
		const u = unit.toLowerCase();
		if (u === 'mg' && value >= 1000) return `${fmt(value / 1000, 1)} g`;
		if ((u === 'µg' || u === 'mcg' || u === 'ug') && value >= 1000) return `${fmt(value / 1000, 1)} mg`;
		return `${fmt(value, 1)} ${unit}`;
	}
</script>

{#snippet summary(stats: { current: TrackerStats; previous: TrackerStats }, unit: string, digits: number)}
	{@const comparison = comparePeriods(stats.current, stats.previous, minDays)}
	<p class="stat">
		<strong>Ø {fmt(stats.current.avgPerDay, digits)} {unit}</strong>
		<span> · {history_days_logged(stats.current.activeDays, stats.current.countableDays)}</span>
	</p>
	<p class="meta">
		{comparison ? history_vs_previous(signed(comparison.delta, unit, digits), period, comparison.previousDays) : history_no_comparison(period, minDays)}
	</p>
{/snippet}

<div class="px-4">
	{#if !hasData && !userSettings.moodTrackerEnabled}
		<p class="empty">{t.history_empty}</p>
	{/if}
	<HistorySurface>
		{#if nutrition.current.activeDays > 0}
			<section class="history-section">
				<h2 class="history-section-header history-section-title">{t.nutrition_label}</h2>
				<div class="history-section-content space-y-3">
					{@render summary(nutrition, 'kcal', 0)}
					{#if goals.kcal}
						<p class="meta">{history_vs_goal(signed(nutrition.current.avgPerDay - goals.kcal, 'kcal'))}</p>
					{/if}
					<PeriodChart bars={bars(nutrition.current)} color={CATEGORY_COLORS.nutrition} format={v => `${fmt(v)}`} unit="kcal" goal={goals.kcal} goalLabel={t.history_goal} onselect={onselectday} />
					{#if macros}
						<div>
							<p class="meta mb-1.5">{t.nutrition_macro_distribution}</p>
							<div class="macro-bar">
								<span style="width: {macros.pct.protein}%; background: #60A5FA"></span>
								<span style="width: {macros.pct.fat}%; background: #FBBF24"></span>
								<span style="width: {macros.pct.carbs}%; background: #34D399"></span>
							</div>
							<div class="macro-legend">
								<span><i style="background: #60A5FA"></i>{t.nutrition_protein} Ø {fmt(macros.avg.protein)} g · {macros.pct.protein}%</span>
								<span><i style="background: #FBBF24"></i>{t.nutrition_fat} Ø {fmt(macros.avg.fat)} g · {macros.pct.fat}%</span>
								<span><i style="background: #34D399"></i>{t.nutrition_carbs} Ø {fmt(macros.avg.carbs)} g · {macros.pct.carbs}%</span>
							</div>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		{#if data.foodMicros && data.foodMicros.kcal > 0}
			<FoodMicros data={data.foodMicros} />
		{/if}

		{#if userSettings.waterTrackerEnabled && water.current.activeDays > 0}
			<section class="history-section">
				<h2 class="history-section-header history-section-title">{t.water_title}</h2>
				<div class="history-section-content space-y-3">
					{@render summary(water, 'ml', 0)}
					<p class="meta">{history_goal_reached(reachedDays(water.current, v => v >= waterGoal), water.current.activeDays)}</p>
					<PeriodChart bars={bars(water.current)} color={CATEGORY_COLORS.water} format={v => fmt(v)} unit="ml" goal={waterGoal} goalLabel={t.history_goal} onselect={onselectday} />
				</div>
			</section>
		{/if}

		{#if userSettings.caffeineTrackerEnabled && caffeine.current.activeDays > 0}
			<section class="history-section">
				<h2 class="history-section-header history-section-title">{t.caffeine_title}</h2>
				<div class="history-section-content space-y-3">
					{@render summary(caffeine, 'mg', 0)}
					<p class="meta">{history_over_limit(reachedDays(caffeine.current, v => v > caffeineLimit), caffeine.current.activeDays)}</p>
					<PeriodChart bars={bars(caffeine.current)} color={CATEGORY_COLORS.caffeine} format={v => fmt(v)} unit="mg" goal={caffeineLimit} goalLabel={t.history_limit} onselect={onselectday} />
				</div>
			</section>
		{/if}

		{#if userSettings.meditationTrackerEnabled && meditation.current.activeDays > 0}
			<section class="history-section">
				<h2 class="history-section-header history-section-title">{t.meditation_title}</h2>
				<div class="history-section-content space-y-3">
					{@render summary(meditation, 'min', 0)}
					<p class="meta">{history_sessions(meditationSessions.length, Math.round(meditationSessions.reduce((s, l) => s + l.durationSeconds, 0) / 60 / Math.max(1, meditationSessions.length)))}</p>
					<PeriodChart bars={bars(meditation.current)} color={CATEGORY_COLORS.meditation} format={v => fmt(v)} unit="min" goal={meditationGoal} goalLabel={t.history_goal} onselect={onselectday} />
				</div>
			</section>
		{/if}

		{#if userSettings.moodTrackerEnabled}
			<MoodHistoryView
				embedded
				onreload={onMoodReload}
				fixedView={period}
				parentDate={range.fromKey}
				{onselectday}
				comparison={moodComparison ? history_vs_previous(signed(moodComparison.delta, '', 1), period, moodComparison.previousDays) : null}
			/>
		{/if}

		{#if adherence.length > 0}
			<section class="history-section">
				<h2 class="history-section-header history-section-title">{t.export_section_supplements}</h2>
				<div class="history-section-content space-y-3">
					{#each adherence as a (a.supplementId)}
						<div>
							<div class="flex items-baseline justify-between gap-2 text-sm mb-1.5">
								<span class="truncate" style="color: var(--color-on-surface)">{a.name}</span>
								<span class="meta shrink-0 tabular-nums">
									{#if a.planned > 0}{a.taken}/{a.planned} · {a.percent}%{:else}{t.history_no_schedule} · {history_taken_days(a.taken, a.countableDays)}{/if}
								</span>
							</div>
							<div class="strip" style="gap: {period === 'month' ? 2 : 4}px">
								{#each a.daily as fill, i (days[i])}
									{#if fill === 'out'}
										<span></span>
									{:else}
										<button
											onclick={() => onselectday(days[i])}
											aria-label={new Date(`${days[i]}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
											style="background: {fillColor(fill)}; {fill === 'unscheduled' ? 'border: 1px dashed var(--color-surface-high)' : ''}"
										></button>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if nutrientEntries.length > 0}
			<section class="history-section">
				<h2 class="history-section-header history-section-title">{t.supplement_stats_nutrients}</h2>
				<div class="history-section-content">
					{#each nutrientsExpanded ? nutrientEntries : nutrientEntries.slice(0, 10) as entry (entry.name + entry.unit)}
						<div class="flex justify-between text-sm py-1">
							<span class="truncate pr-2" style="color: var(--color-on-surface)">{entry.name}</span>
							<span class="font-medium tabular-nums" style="color: var(--color-on-surface)">{formatNutrient(entry.total, entry.unit)}</span>
						</div>
					{/each}
					{#if nutrientEntries.length > 10}
						<button onclick={() => nutrientsExpanded = !nutrientsExpanded} class="w-full text-right text-xs font-medium pt-2 active:opacity-60" style="color: var(--color-primary)">
							{nutrientsExpanded ? t.supplement_stats_show_less : nutrients_show_more(nutrientEntries.length - 10)}
						</button>
					{/if}
				</div>
			</section>
		{/if}
	</HistorySurface>

	{#if hasData}
		<p class="note">{t.history_tap_day_hint} {t.history_settings_note}</p>
	{:else if userSettings.moodTrackerEnabled && mood.current.activeDays === 0}
		<p class="empty">{t.history_empty}</p>
	{/if}
</div>

<style>
	h2.history-section-header { margin: 0; }
	.stat { font-size: 14px; color: var(--color-on-surface); font-variant-numeric: tabular-nums; }
	.stat span { color: var(--color-on-surface-variant); font-size: 13px; }
	.meta { font-size: 12px; line-height: 1.4; color: var(--color-on-surface-variant); }
	.macro-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--color-surface-high); }
	.macro-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; font-size: 12px; color: var(--color-on-surface-variant); font-variant-numeric: tabular-nums; }
	.macro-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }
	.strip { display: flex; height: 18px; }
	.strip > * { flex: 1; min-width: 0; border-radius: 3px; border: 0; padding: 0; }
	.strip button:active { opacity: 0.6; }
	.note { margin-top: 12px; font-size: 12px; line-height: 1.45; color: var(--color-on-surface-variant); }
	.empty { padding: 40px 16px; text-align: center; font-size: 14px; color: var(--color-on-surface-variant); }
</style>
