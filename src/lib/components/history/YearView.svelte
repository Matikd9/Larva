<script lang="ts">
	// Year: a 12-month calendar heatmap plus monthly averages for the chosen category.
	// "Logging" (default) shows how many categories were logged per day, never how healthy a day was.
	import { t, currentLang, history_days_logged, history_categories_logged } from '#lib/i18n.svelte';
	import { userSettings } from '#lib/userSettings.svelte';
	import { todayKey, tsToDateKey } from '#lib/dates';
	import { MOOD_LEVELS, getMoodLevel } from '#lib/mood';
	import { computeTrackerStats, eachDayInRange } from '#lib/trackerStats';
	import { coverageByDay, coverageLevel, quartiles, valueLevel, type CoverageCategory } from '#lib/historyMetrics';
	import { periodRange, type PeriodRange } from '#lib/historyRange';
	import { historyView } from '#lib/historyState.svelte';
	import PeriodChart, { type Bar } from './PeriodChart.svelte';
	import HistorySurface from '../supplements/HistorySurface.svelte';
	import FoodMicros from './FoodMicros.svelte';
	import { CATEGORY_COLORS, type HistoryData } from './historyData';

	let { range, data, onselectday, onselectmonth }: {
		range: PeriodRange;
		data: HistoryData;
		onselectday: (dateKey: string) => void;
		onselectmonth: (dateKey: string) => void;
	} = $props();

	const locale = $derived(currentLang() === 'en' ? 'en-US' : 'de-DE');
	const today = todayKey();
	const fmt = (value: number, digits = 0) => value.toLocaleString(locale, { maximumFractionDigits: digits });
	const days = $derived(eachDayInRange(range));

	const LABELS: Record<CoverageCategory, () => string> = {
		nutrition: () => t.nutrition_label,
		supplements: () => t.export_section_supplements,
		water: () => t.water_title,
		caffeine: () => t.caffeine_title,
		meditation: () => t.meditation_title,
		mood: () => t.mood_tracker_label
	};
	const UNITS: Record<CoverageCategory, string> = { nutrition: 'kcal', supplements: '', water: 'ml', caffeine: 'mg', meditation: 'min', mood: '/5' };

	const enabled = $derived<CoverageCategory[]>([
		'nutrition',
		...(data.supplements.length > 0 ? ['supplements' as const] : []),
		...(userSettings.waterTrackerEnabled ? ['water' as const] : []),
		...(userSettings.caffeineTrackerEnabled ? ['caffeine' as const] : []),
		...(userSettings.meditationTrackerEnabled ? ['meditation' as const] : []),
		...(userSettings.moodTrackerEnabled ? ['mood' as const] : [])
	]);

	// Value per day and category: kcal, ml, mg, minutes, mood 1–5, distinct supplements taken.
	const values = $derived.by(() => {
		const byCategory: Record<CoverageCategory, Map<string, number>> = {
			nutrition: new Map(), supplements: new Map(), water: new Map(), caffeine: new Map(), meditation: new Map(), mood: new Map()
		};
		const add = (category: CoverageCategory, day: string, value: number) => byCategory[category].set(day, (byCategory[category].get(day) ?? 0) + value);
		for (const d of data.mealDays) if (d.meals > 0) add('nutrition', d.date, d.kcal);
		for (const l of data.water) add('water', tsToDateKey(l.loggedAt), l.amountMl);
		for (const l of data.caffeine) add('caffeine', tsToDateKey(l.loggedAt), l.caffeineMg);
		for (const l of data.meditation) add('meditation', tsToDateKey(l.loggedAt), l.durationSeconds / 60);
		for (const l of data.mood) byCategory.mood.set(l.date, l.mood);
		const taken = new Map<string, Set<string>>();
		for (const l of data.supplementLogs) {
			const day = tsToDateKey(l.loggedAt);
			taken.set(day, (taken.get(day) ?? new Set()).add(l.supplementId));
		}
		for (const [day, set] of taken) byCategory.supplements.set(day, set.size);
		return byCategory;
	});

	const coverage = $derived(coverageByDay(
		days.filter(d => d <= today),
		Object.fromEntries(Object.entries(values).map(([c, map]) => [c, new Set(map.keys())])),
		enabled
	));

	// First recorded day per category in this year; days before it are "not started", not gaps.
	const firstEntry = $derived(Object.fromEntries(Object.entries(values).map(([c, map]) => [c, [...map.keys()].sort()[0] ?? '']))) as Record<CoverageCategory, string>;
	const sinceFirst = (first: string) => (first ? days.filter(d => d >= first && d <= today).length : 0);

	const category = $derived(historyView.yearCategory === 'coverage' || enabled.includes(historyView.yearCategory) ? historyView.yearCategory : 'coverage');
	const q = $derived(category === 'coverage' || category === 'mood' ? null : quartiles([...values[category].values()]));
	const color = $derived(category === 'coverage' ? 'var(--color-primary)' : CATEGORY_COLORS[category]);
	const levelColor = (level: number, base: string) => `color-mix(in srgb, ${base} ${[0, 30, 52, 76, 100][level]}%, var(--color-surface-container))`;

	type Cell = { day: string; fill: string | null; title: string; future: boolean; idle: boolean };
	function cell(day: string): Cell {
		const label = new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
		if (day > today) return { day, fill: null, title: label, future: true, idle: false };
		if (category === 'coverage') {
			const c = coverage.get(day);
			const level = coverageLevel(c);
			return {
				day,
				fill: level === 0 ? null : levelColor(level, color),
				title: `${label}: ${c && c.considered > 0 ? history_categories_logged(c.registered, c.considered) : t.history_no_record}`,
				future: false,
				idle: !c || c.considered === 0 // before the first entry of any category this year
			};
		}
		const value = values[category].get(day);
		if (value === undefined) return { day, fill: null, title: `${label}: ${t.history_no_record}`, future: false, idle: !firstEntry[category] || day < firstEntry[category] };
		const fill = category === 'mood' ? getMoodLevel(value).color : levelColor(q ? valueLevel(value, q) : 4, color);
		return { day, fill, title: `${label}: ${fmt(value, category === 'mood' ? 0 : 0)} ${UNITS[category]}`.trim(), future: false, idle: false };
	}

	const months = $derived(Array.from({ length: 12 }, (_, m) => {
		const first = new Date(new Date(range.from).getFullYear(), m, 1);
		const monthRange = periodRange('month', `${first.getFullYear()}-${String(m + 1).padStart(2, '0')}-01`);
		return {
			key: monthRange.fromKey,
			name: first.toLocaleDateString(locale, { month: 'short' }),
			offset: (first.getDay() + 6) % 7,
			range: monthRange,
			cells: eachDayInRange(monthRange).map(cell)
		};
	}));

	// Monthly bars: days with entries (Logging) or the average per logged day (a category).
	const monthBars = $derived<Bar[]>(months.map(month => {
		const disabled = month.range.fromKey > today;
		if (category === 'coverage') {
			const logged = month.cells.filter(c => (coverage.get(c.day)?.registered ?? 0) > 0).length;
			return { key: month.key, label: month.name.slice(0, 3), title: month.name, value: logged, recorded: logged > 0, disabled, sub: disabled ? '' : String(logged) };
		}
		const stats = computeTrackerStats([...values[category]].map(([date, value]) => ({ date, value })), month.range);
		return {
			key: month.key, label: month.name.slice(0, 3), title: `${month.name} · ${history_days_logged(stats.activeDays, stats.countableDays)}`,
			value: stats.avgPerDay, recorded: stats.activeDays > 0, disabled, sub: disabled ? '' : `${stats.activeDays}d`
		};
	}));

	const yearStats = $derived(category === 'coverage' ? null
		: computeTrackerStats([...values[category]].map(([date, value]) => ({ date, value })), range));
	const loggedDays = $derived([...coverage.values()].filter(c => c.registered > 0).length);
	const countableDays = $derived([...coverage.values()].filter(c => c.considered > 0).length);
</script>

<div class="px-4">
	<div class="chips" role="radiogroup" aria-label={t.history_period_year}>
		{#each ['coverage' as const, ...enabled] as option (option)}
			<button
				role="radio"
				aria-checked={category === option}
				class:active={category === option}
				onclick={() => historyView.yearCategory = option}
			>{option === 'coverage' ? t.history_year_coverage : LABELS[option]()}</button>
		{/each}
	</div>

	<HistorySurface>
		<section class="history-section">
			<div class="history-section-header">
				<p class="stat">
					{#if yearStats}
						<strong>Ø {fmt(yearStats.avgPerDay, category === 'mood' ? 1 : 0)}{category === 'mood' ? '' : ' '}{UNITS[category === 'coverage' ? 'nutrition' : category]}</strong>
						<span> · {history_days_logged(yearStats.activeDays, sinceFirst(firstEntry[category as CoverageCategory]))}</span>
					{:else}
						<strong>{history_days_logged(loggedDays, countableDays)}</strong>
					{/if}
				</p>
				{#if category === 'coverage'}
					<p class="meta mt-1">{t.history_year_coverage_hint}</p>
				{/if}
			</div>
			<div class="history-section-content">
				<div class="months">
					{#each months as month (month.key)}
						<div>
							<button class="month-name" onclick={() => onselectmonth(month.key)}>{month.name}</button>
							<div class="grid">
								{#each { length: month.offset } as _, i (i)}<span></span>{/each}
								{#each month.cells as c (c.day)}
									{#if c.future}
										<span></span>
									{:else}
										<button
											class="cell"
											class:empty={!c.fill}
											class:idle={c.idle}
											style:background={c.fill}
											title={c.title}
											aria-label={c.title}
											onclick={() => onselectday(c.day)}
										></button>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<div class="legend">
					<span class="cell empty sample"></span><span>{t.history_no_record}</span>
					<span class="sep"></span>
					{#if category === 'mood'}
						{#each MOOD_LEVELS as level (level.value)}
							<span class="cell sample" style:background={level.color} title={t[level.labelKey as keyof typeof t]}></span>
						{/each}
						<span>1–5</span>
					{:else}
						<span>{t.history_less}</span>
						{#each [1, 2, 3, 4] as level (level)}
							<span class="cell sample" style:background={levelColor(level, color)}></span>
						{/each}
						<span>{t.history_more}</span>
					{/if}
				</div>
				{#if q}
					<p class="meta mt-1 tabular-nums">≤ {fmt(q[0])} · ≤ {fmt(q[1])} · ≤ {fmt(q[2])} · &gt; {fmt(q[2])} {UNITS[category === 'coverage' ? 'nutrition' : category]}</p>
				{:else if category === 'coverage'}
					<p class="meta mt-1">≤ 25 % · ≤ 50 % · ≤ 75 % · &gt; 75 %</p>
				{/if}
			</div>
		</section>

		<section class="history-section">
			<h2 class="history-section-header history-section-title">{category === 'coverage' ? t.history_year_monthly_days : t.history_year_monthly_avg}</h2>
			<div class="history-section-content">
				<PeriodChart bars={monthBars} {color} format={v => fmt(v, category === 'mood' ? 1 : 0)} onselect={onselectmonth} />
			</div>
		</section>

		{#if (category === 'coverage' || category === 'nutrition') && data.foodMicros && data.foodMicros.kcal > 0}
			<FoodMicros data={data.foodMicros} />
		{/if}
	</HistorySurface>

	<p class="note">{t.history_tap_day_hint} {t.history_settings_note}</p>
</div>

<style>
	h2.history-section-header { margin: 0; }
	.chips { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 12px; scrollbar-width: none; }
	.chips button {
		flex-shrink: 0; min-height: 34px; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600;
		border: 1px solid var(--bubble-container-border); background: var(--bubble-container-bg); color: var(--color-on-surface-variant);
	}
	.chips button.active { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
	.stat { font-size: 14px; color: var(--color-on-surface); font-variant-numeric: tabular-nums; }
	.stat span { color: var(--color-on-surface-variant); font-size: 13px; }
	.meta { font-size: 12px; line-height: 1.4; color: var(--color-on-surface-variant); }
	.months { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 12px; }
	.month-name {
		display: block; margin-bottom: 4px; padding: 0; border: 0; background: none; text-transform: capitalize;
		font-size: 12px; font-weight: 650; color: var(--color-on-surface);
	}
	.grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
	.grid > * { aspect-ratio: 1; min-width: 0; }
	.cell { display: block; padding: 0; border: 0; border-radius: 3px; }
	.cell.empty { background: transparent; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-on-surface-variant) 30%, transparent); }
	.cell.idle { opacity: 0.4; }
	button.cell:active { opacity: 0.6; }
	button.cell:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
	.legend { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 14px; font-size: 11px; color: var(--color-on-surface-variant); }
	.legend .sample { width: 12px; height: 12px; }
	.legend .sep { width: 8px; }
	.note { margin-top: 12px; font-size: 12px; line-height: 1.45; color: var(--color-on-surface-variant); }
</style>
