<script lang="ts">
	// History: analysis by week, month and year, plus PDF export. A tapped day opens the home screen,
	// which already shows and edits single days; History keeps its place for the way back.
	import { goto } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
	import TrackerHeader from '#lib/components/supplements/TrackerHeader.svelte';
	import TrackerDateNav from '#lib/components/supplements/TrackerDateNav.svelte';
	import { measureHeight } from '#lib/measureHeight';
	import HamburgerMenu from '#lib/components/HamburgerMenu.svelte';
	import { t, currentLang } from '#lib/i18n.svelte';
	import { getPendingLogs } from '#lib/sync/manager';
	import { userSettings } from '#lib/userSettings.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import PeriodView from '#lib/components/history/PeriodView.svelte';
	import YearView from '#lib/components/history/YearView.svelte';
	import { emptyHistoryData, type HistoryData } from '#lib/components/history/historyData';
	import ExportSheet from '#lib/components/supplements/ExportSheet.svelte';
	import { exportReport, type ReportSections } from '#lib/pdfExport';
	import { findTag } from '#lib/mood';
	import { toLocalDateKey } from '#lib/dates';
	import { periodRange, previousRange, shiftPeriod, containsToday, type HistoryPeriod, type PeriodRange } from '#lib/historyRange';
	import { historyView } from '#lib/historyState.svelte';

	let { data: page } = $props();

	let menuOpen = $state(false);
	let scrollContainer = $state<HTMLElement | null>(null);
	let headerHidden = $state(false);
	let overlayHeight = $state(0);
	let lastScrollY = 0;
	let scrollRaf = 0;
	function onScroll() {
		if (!scrollContainer || scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			if (!scrollContainer) return;
			const y = scrollContainer.scrollTop;
			const max = scrollContainer.scrollHeight - scrollContainer.clientHeight;
			if (y <= 0) { headerHidden = false; lastScrollY = 0; return; }
			if (y >= max - 2) { lastScrollY = y; return; }
			const delta = y - lastScrollY;
			if (y < 12) headerHidden = false;
			else if (delta > 6) headerHidden = true;
			else if (delta < -6) headerHidden = false;
			lastScrollY = y;
		});
	}

	const range = $derived(periodRange(historyView.period, historyView.date));
	const previous = $derived(historyView.period === 'year' ? range : previousRange(historyView.period, historyView.date));
	// Period, ranges and data change together, so a view never mixes a new range with old data.
	let shown = $state<{ period: HistoryPeriod; range: PeriodRange; previous: PeriodRange; data: HistoryData } | null>(null);
	const data = $derived(shown?.data ?? emptyHistoryData());
	let loading = $state(true);
	let loadError = $state(false);
	let goals = $state<{ kcal: number | null; protein: number | null; fat: number | null; carbs: number | null }>({ kcal: null, protein: null, fat: null, carbs: null });
	let requestId = 0;
	let restoreScroll = historyView.scrollTop;

	async function json<T>(url: string): Promise<T> {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${res.status} ${url}`);
		return res.json() as Promise<T>;
	}

	type PendingType = Parameters<typeof getPendingLogs>[0];
	/** Server rows plus writes still queued offline, so History never lags behind the home screen. */
	async function withPending<T extends { clientLogId?: string | null }>(rows: T[], type: PendingType, from: number, to: number): Promise<T[]> {
		const known = new Set(rows.map(row => row.clientLogId).filter(Boolean));
		const pending = (await getPendingLogs(type, from, to)).filter(row => !known.has(row.clientLogId as string));
		return [...rows, ...pending.map(row => ({ id: row.clientLogId, ...row }) as unknown as T)];
	}

	async function load() {
		const id = ++requestId;
		const period = historyView.period;
		const current = range;
		const before = previous;
		const from = before.from;
		const fromKey = before.fromKey;
		loading = true;
		loadError = false;
		try {
			const logs = <T,>(endpoint: string, on: boolean) => on ? json<{ logs: T[] }>(`/api/${endpoint}?from=${from}&to=${current.to}`).then(r => r.logs ?? []) : Promise.resolve([] as T[]);
			const [stats, water, caffeine, meditation, meals, mood, foodMicros] = await Promise.all([
				json<{ logs?: HistoryData['supplementLogs']; schedules?: HistoryData['schedules']; allSupplements?: HistoryData['supplements']; nutrients?: HistoryData['supplementNutrients'] }>(
					`/api/supplement-stats?period=${period}&from=${current.from}&to=${current.to}`),
				logs<HistoryData['water'][number] & { clientLogId?: string }>('water-logs', userSettings.waterTrackerEnabled),
				logs<HistoryData['caffeine'][number] & { clientLogId?: string }>('caffeine-logs', userSettings.caffeineTrackerEnabled),
				logs<HistoryData['meditation'][number] & { clientLogId?: string }>('meditation-logs', userSettings.meditationTrackerEnabled),
				json<{ days?: HistoryData['mealDays'] }>(`/api/nutrition/meals?summary=1&from=${fromKey}&to=${current.toKey}`),
				userSettings.moodTrackerEnabled
					? json<{ logs?: HistoryData['mood'] }>(`/api/mood-logs?from=${fromKey}&to=${current.toKey}`).then(r => r.logs ?? [])
					: Promise.resolve([]),
				period === 'week' ? Promise.resolve(null) : json<HistoryData['foodMicros']>(`/api/nutrition/meals?micros=1&from=${current.fromKey}&to=${current.toKey}`)
			]);
			const next: HistoryData = {
				supplementLogs: await withPending(stats.logs ?? [], 'create_supplement_log', current.from, current.to),
				schedules: stats.schedules ?? [],
				supplements: stats.allSupplements ?? [],
				supplementNutrients: stats.nutrients ?? {},
				water: userSettings.waterTrackerEnabled ? await withPending(water, 'create_water_log', from, current.to) : [],
				caffeine: userSettings.caffeineTrackerEnabled ? await withPending(caffeine, 'create_caffeine_log', from, current.to) : [],
				meditation: userSettings.meditationTrackerEnabled ? await withPending(meditation, 'create_meditation_log', from, current.to) : [],
				mealDays: meals.days ?? [],
				mood,
				foodMicros
			};
			if (id !== requestId) return; // a newer period was requested meanwhile
			shown = { period, range: current, previous: before, data: next };
			loading = false;
			if (restoreScroll > 0) {
				const top = restoreScroll;
				restoreScroll = 0;
				await tick();
				scrollContainer?.scrollTo({ top });
			}
		} catch {
			if (id !== requestId) return;
			loadError = true;
			loading = false;
		}
	}

	$effect(() => {
		void range.from;
		void historyView.period;
		untrack(() => void load());
	});

	onMount(() => {
		void (async () => {
			try {
				const g = (await json<{ goals?: { dailyKcal?: number; dailyProtein?: number; dailyFat?: number; dailyCarbs?: number } }>('/api/nutrition/goals')).goals;
				goals = { kcal: g?.dailyKcal ?? null, protein: g?.dailyProtein ?? null, fat: g?.dailyFat ?? null, carbs: g?.dailyCarbs ?? null };
			} catch { /* goal lines are optional */ }
		})();
	});

	function selectPeriod(period: HistoryPeriod) {
		if (historyView.period === period) return;
		historyView.period = period;
		scrollContainer?.scrollTo({ top: 0 });
	}

	function navigate(dir: -1 | 1) {
		historyView.date = shiftPeriod(historyView.period, historyView.date, dir);
	}

	function openDay(dateKey: string) {
		historyView.scrollTop = scrollContainer?.scrollTop ?? 0;
		void goto(`/?date=${dateKey}`);
	}

	function openMonth(dateKey: string) {
		historyView.period = 'month';
		historyView.date = dateKey;
		scrollContainer?.scrollTo({ top: 0 });
	}

	function periodLabel(): string {
		const locale = currentLang() === 'en' ? 'en-US' : 'de-DE';
		const start = new Date(`${range.fromKey}T12:00:00`);
		if (historyView.period === 'year') return String(start.getFullYear());
		if (historyView.period === 'month') return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
		const end = new Date(`${range.toKey}T12:00:00`);
		return `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
	}

	// ── PDF export ─────────────────────────────────────────────────────────────
	let exporting = $state(false);
	let exportSheetOpen = $state(false);
	type MoodRow = { date: string; mood: number; energy?: number | null; activities?: string[]; note?: string | null; gratitude?: string | null };

	async function readMoodLogs(res: Response | null): Promise<MoodRow[]> {
		if (!res || !res.ok) return [];
		try {
			const body = await res.json();
			return (body.logs ?? []).map((l: { date: string; mood: number; energy?: number | null; activities?: string; note?: string | null; gratitude?: string | null }) => ({
				date: l.date,
				mood: l.mood,
				energy: l.energy ?? null,
				activities: l.activities ? (() => { try { return JSON.parse(l.activities) as string[]; } catch { return []; } })() : [],
				note: l.note ?? null,
				gratitude: l.gratitude ?? null
			}));
		} catch { return []; }
	}

	async function runExport(opts: { from: number; to: number; name: string; sections: ReportSections }) {
		if (exporting) return;
		exporting = true;
		try {
			const { from, to, name, sections } = opts;
			const inRange = <T extends { loggedAt: number }>(rows: T[]) => rows.filter(row => row.loggedAt >= from && row.loggedAt <= to);
			let supps = data.supplements;
			let schedules = data.schedules;
			let logs = data.supplementLogs;
			let caffLogs = inRange(data.caffeine);
			let medLogs = inRange(data.meditation);
			let nutrients = data.supplementNutrients;
			const moodFetch = (userSettings.moodTrackerEnabled && sections.mood)
				? fetch(`/api/mood-logs?from=${toLocalDateKey(new Date(from))}&to=${toLocalDateKey(new Date(to))}`).catch(() => null)
				: Promise.resolve(null);
			let moodLogs: MoodRow[];
			if (from !== range.from || to !== range.to) {
				const [statsRes, caffRes, medRes, moodRes] = await Promise.all([
					fetch(`/api/supplement-stats?period=month&from=${from}&to=${to}`),
					userSettings.caffeineTrackerEnabled ? fetch(`/api/caffeine-logs?from=${from}&to=${to}`) : Promise.resolve(null),
					userSettings.meditationTrackerEnabled ? fetch(`/api/meditation-logs?from=${from}&to=${to}`) : Promise.resolve(null),
					moodFetch
				]);
				if (statsRes.ok) {
					const body = await statsRes.json();
					supps = body.allSupplements ?? [];
					schedules = body.schedules ?? [];
					logs = body.logs ?? [];
					nutrients = body.nutrients ?? {};
				}
				caffLogs = caffRes && caffRes.ok ? (await caffRes.json()).logs ?? [] : [];
				medLogs = medRes && medRes.ok ? (await medRes.json()).logs ?? [] : [];
				moodLogs = await readMoodLogs(moodRes);
			} else {
				moodLogs = await readMoodLogs(await moodFetch);
			}
			const moodLabels: Record<number, string> = {
				1: t.mood_very_bad, 2: t.mood_bad, 3: t.mood_okay, 4: t.mood_good, 5: t.mood_great
			};
			const moodActivityLabels: Record<string, string> = {};
			for (const log of moodLogs) {
				for (const key of log.activities ?? []) {
					if (moodActivityLabels[key]) continue;
					const tag = findTag(key);
					moodActivityLabels[key] = tag ? ((t[tag.labelKey as keyof typeof t] as string) ?? key) : key;
				}
			}
			await exportReport({
				template: 'full',
				range: { from, to },
				lang: currentLang() === 'en' ? 'en' : 'de',
				name,
				sections,
				supplements: supps,
				schedules,
				supplementLogs: logs.map(l => ({ supplementId: l.supplementId, amount: l.amount, loggedAt: l.loggedAt })),
				caffeineLogs: caffLogs.map(l => ({ caffeineMg: l.caffeineMg, loggedAt: l.loggedAt })),
				meditationLogs: medLogs.map(l => ({ durationSeconds: l.durationSeconds, loggedAt: l.loggedAt })),
				moodLogs,
				moodLabels,
				moodActivityLabels,
				nutrientTotals: Object.values(nutrients).map(n => ({ name: n.name, total: n.total, unit: n.unit }))
			});
		} finally {
			exporting = false;
		}
	}
</script>

<div class="tracker-workspace with-date"
	style:--tracker-header-height={overlayHeight > 0 ? `${overlayHeight}px` : undefined}>

	{#snippet headerExportAction()}
		<button
			onclick={() => exportSheetOpen = true}
			disabled={exporting}
			aria-label="Export PDF"
			class="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60 disabled:opacity-40"
			style="color: var(--color-on-surface-variant)"
		>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
			</svg>
		</button>
	{/snippet}

	{#snippet periodControls()}
		<div class="flex px-2">
			{#each (['week', 'month', 'year'] as const) as period (period)}
				<button
					onclick={() => selectPeriod(period)}
					class="flex-1 min-h-10 py-2 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-3px]"
					aria-pressed={historyView.period === period}
					style="color: {historyView.period === period ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
				>
					{period === 'week' ? t.supplement_stats_week : period === 'month' ? t.supplement_stats_month : t.history_period_year}
				</button>
			{/each}
		</div>
	{/snippet}

	<div use:measureHeight={(height) => overlayHeight = height} class="tracker-header-overlay">
		<TrackerHeader
			title={t.supplement_tab_history}
			onMenuOpen={() => menuOpen = true}
			actions={headerExportAction}
			collapsed={headerHidden}
			activeSection="history"
			historyControls={periodControls}
		/>
		<TrackerDateNav
			onPrevious={() => navigate(-1)} onNext={() => navigate(1)}
			previousLabel={t.a11y_previous_period} nextLabel={t.a11y_next_period}
			nextDisabled={containsToday(range)}
		>
			<span class="text-sm font-semibold" style="color: var(--color-on-surface)">{periodLabel()}</span>
		</TrackerDateNav>
	</div>

	<div bind:this={scrollContainer}
	     onscroll={onScroll}
	     class="absolute inset-0 overflow-y-auto"
	     style="padding-top: var(--tracker-header-height); padding-bottom: 5.5rem; overscroll-behavior: none;">
		{#if loadError}
			<div class="px-6 py-12 text-center">
				<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.history_load_error}</p>
				<button onclick={() => load()} class="mt-4 px-4 py-2 rounded-full text-sm font-semibold active:opacity-60"
					style="background-color: var(--color-primary); color: var(--color-on-primary)">{t.offline_retry}</button>
			</div>
		{:else if !shown}
			<div class="flex justify-center py-8">
				<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else}
			<div class:loading-dim={loading}>
				{#if shown.period === 'year'}
					<YearView range={shown.range} data={shown.data} onselectday={openDay} onselectmonth={openMonth} />
				{:else}
					{#key shown.range.from}
						<PeriodView period={shown.period} range={shown.range} previous={shown.previous} data={shown.data} {goals} onselectday={openDay} onMoodReload={load} />
					{/key}
				{/if}
			</div>
		{/if}
	</div>
</div>

<AppBottomNav activeTab="history" />

<ExportSheet bind:open={exportSheetOpen} currentRange={{ from: range.from, to: range.to }} onConfirm={(opts) => runExport(opts)} />

<HamburgerMenu bind:open={menuOpen} user={page.user} />

<style>
	.loading-dim { opacity: 0.55; transition: opacity 0.15s; pointer-events: none; }
</style>
