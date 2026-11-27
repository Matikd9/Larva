<script lang="ts">
	// Supplements, water, caffeine, meditation and mood for one day of the nutrition home.
	// Carried over from the former Tracker "Today" tab; the page's date picker drives `date`.
	import { onMount, tick } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { t, currentLang } from '#lib/i18n.svelte';
	import { cacheSupplements, getOfflineSupplements, mergePendingSupplementStock, cacheTodayLogs, getOfflineTodayLogs, cacheWaterLogs, getOfflineWaterLogsToday, cacheCaffeineLogs, getOfflineCaffeineLogsToday, cacheCaffeineDrinks, getOfflineCaffeineDrinks, cacheMeditationLogs, getOfflineMeditationLogsToday, onSupplementLogSynced, getPendingLogs } from '#lib/sync/manager';
	import { displayUnit } from '#lib/units';
	import { formatTime, toLocalDateKey, tsToDateKey } from '#lib/dates';
	import { flushUserSettings, userSettings } from '#lib/userSettings.svelte';
	import { layoutBottomUpRows } from '#lib/supplements/quickLogGrid';
	import type { WaterLog, CaffeineLog, CaffeineDrink, MeditationLog } from '#lib/db/schema';
	import QuickLogSheet from './QuickLogSheet.svelte';
	import EditLogSheet from './EditLogSheet.svelte';
	import WaterTrackerCard from './WaterTrackerCard.svelte';
	import CaffeineTrackerCard from './CaffeineTrackerCard.svelte';
	import MeditationTrackerCard from './MeditationTrackerCard.svelte';
	import MeditationTimerSheet from './MeditationTimerSheet.svelte';
	import MoodTrackerCard from './MoodTrackerCard.svelte';
	import MoodEntrySheet from './MoodEntrySheet.svelte';
	import MoodWeeklyReview from './MoodWeeklyReview.svelte';

	let {
		date,
		userId,
		nutritionTotalKcal = 0,
		nutritionGoalKcal = null,
		onaddmeal
	}: {
		date: string; // YYYY-MM-DD
		userId: string | null;
		nutritionTotalKcal?: number;
		nutritionGoalKcal?: number | null;
		onaddmeal: () => void;
	} = $props();

	type Nutrient = { id: string; name: string; amountPerUnit: number; unit: string; sortOrder: number };
	type Supplement = {
		id: string; name: string; unit: string; notes: string | null;
		brand: string | null;
		active: boolean; sortOrder: number; updatedAt: number;
		stockQuantity: number | null; defaultAmount: number;
		nutrients: Nutrient[];
	};
	type Log = { id: string; supplementId: string; amount: number; loggedAt: number; note?: string | null; clientLogId?: string | null };
	type MoodEntry = { date: string; mood: number; energy: number | null; activities: string[]; note: string | null; gratitude: string | null };
	type MoodReviewLog = { date: string; mood: number; energy: number | null; activities: string | null };
	type TrackerId = 'caffeine' | 'water' | 'meditation' | 'mood';
	type TrackerFocus = 'caffeine' | 'water' | 'meditation';

	let supplements = $state<Supplement[]>([]);
	let dayLogs = $state<Log[]>([]);
	let waterLogs = $state<WaterLog[]>([]);
	let waterHasReminderToday = $state(false);
	let caffeineLogs = $state<CaffeineLog[]>([]);
	let caffeineDrinks = $state<CaffeineDrink[]>([]);
	let meditationLogs = $state<MeditationLog[]>([]);
	let moodEntry = $state<MoodEntry | null>(null);
	let previousWeekMoodLogs = $state<MoodReviewLog[]>([]);
	let previousWeekRange = $state({ from: '', to: '' });
	let locallyDismissedMoodWeeklyReviewWeek = $state('');
	let loading = $state(true);

	let quickLogOpen = $state(false);
	let quickLogInitialTab = $state<'tracker' | 'supplements' | null>(null);
	let quickLogInitialTracker = $state<TrackerFocus | null>(null);
	let moodEntryOpen = $state(false);
	let meditationTimerOpen = $state(false);
	let meditationTimerDuration = $state(10);
	type EditLogSheetType = { id: string; supplementName: string; unit: string; amount: number; time: string; date?: string; note: string | null };
	let editLogSheet = $state<EditLogSheetType | null>(null);
	let addLogSheet = $state<{ date: string } | null>(null);

	let trackerFocus = $state<TrackerFocus | null>(null);
	let expandedIds = $state(new Set<string>());
	let waterExpanded = $state(false);
	let caffeineExpanded = $state(false);
	let meditationExpanded = $state(false);
	let moodExpanded = $state(false);
	let containerEl = $state<HTMLElement | null>(null);

	let supplementsRequestId = 0;
	let loadRequestId = 0;

	const isToday = $derived(date === toLocalDateKey(new Date()));
	const dayStart = $derived(new Date(`${date}T00:00:00`).getTime());
	const dayEnd = $derived.by(() => {
		const next = new Date(`${date}T00:00:00`);
		next.setDate(next.getDate() + 1);
		return next.getTime() - 1;
	});

	const activeSupplements = $derived(supplements.filter(s => s.active));
	const loggedSupplements = $derived(activeSupplements.filter(s => logsForSupplement(s.id).length > 0));
	const supplementRows = $derived(layoutBottomUpRows(loggedSupplements, 3));
	const visibleCaffeineDrinks = $derived(caffeineDrinks.filter(d => !(userSettings.caffeineHiddenDrinks ?? []).includes(d.id)));
	const visibleTrackers = $derived(
		([
			userSettings.caffeineTrackerEnabled && caffeineLogs.length > 0 ? 'caffeine' : null,
			userSettings.waterTrackerEnabled && (waterLogs.length > 0 || (isToday && waterHasReminderToday)) ? 'water' : null,
			userSettings.meditationTrackerEnabled && meditationLogs.length > 0 ? 'meditation' : null,
			userSettings.moodTrackerEnabled && moodEntry !== null ? 'mood' : null
		] as Array<TrackerId | null>).filter((tracker): tracker is TrackerId => tracker !== null)
	);
	const trackerRows = $derived(trackerFocus ? [[trackerFocus] as TrackerId[]] : layoutBottomUpRows(visibleTrackers, 2));
	const showMoodWeeklyReview = $derived(isToday && userSettings.moodTrackerEnabled && userSettings.moodWeeklyReviewEnabled && previousWeekMoodLogs.length >= 4 && userSettings.dismissedMoodWeeklyReviewWeek !== previousWeekRange.from && locallyDismissedMoodWeeklyReviewWeek !== previousWeekRange.from);
	const moodWeeklyReviewDismissKey = $derived(`groly_mood_weekly_review_dismissed:${userId ?? 'anonymous'}`);
	const isEmpty = $derived(loggedSupplements.length === 0 && visibleTrackers.length === 0 && !showMoodWeeklyReview);

	/** Opens the quick-log sheet (FAB, shortcuts and push deep links). */
	export function openQuickLog(tab: 'tracker' | 'supplements' | null = null, tracker: TrackerFocus | null = null) {
		quickLogInitialTab = tab;
		quickLogInitialTracker = tracker;
		quickLogOpen = true;
	}

	/** Opens the mood entry for the shown day. */
	export function openMoodEntry() {
		moodEntryOpen = true;
	}

	function logsForSupplement(supplementId: string): Log[] {
		return dayLogs.filter(l => l.supplementId === supplementId);
	}

	function totalAmount(supplementId: string): number {
		return logsForSupplement(supplementId).reduce((sum, l) => sum + l.amount, 0);
	}

	function allLogTimes(supplementId: string): string {
		const logs = logsForSupplement(supplementId);
		if (logs.length === 0) return '';
		return `(${logs.slice().sort((a, b) => a.loggedAt - b.loggedAt).map(l => formatTime(l.loggedAt)).join(', ')})`;
	}

	function formatNutrientValue(val: number): string {
		if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + ' g';
		if (val % 1 === 0) return val.toString();
		return val.toFixed(1);
	}

	type PendingLogType = Parameters<typeof getPendingLogs>[0];
	// Offline caches hold today only; past days use the server plus writes still waiting in the queue.
	async function fetchDayLogs<T>(endpoint: string, pendingType: PendingLogType, cache: (logs: T[], requestStartedAt: number, userId: string | null) => Promise<unknown[]>, offline: () => Promise<unknown[]>): Promise<T[]> {
		const requestStartedAt = Date.now();
		const today = isToday;
		const [from, to] = [dayStart, dayEnd];
		let serverLogs: T[] = [];
		try {
			const res = await fetch(`${endpoint}?from=${from}&to=${to}`);
			if (!res.ok) throw new Error();
			serverLogs = (await res.json()).logs as T[];
			if (today) return (await cache(serverLogs, requestStartedAt, userId)) as T[];
		} catch {
			if (today) return (await offline()) as T[];
		}
		const known = new Set(serverLogs.map(log => (log as { clientLogId?: string | null }).clientLogId).filter(Boolean));
		const pending = (await getPendingLogs(pendingType, from, to))
			.filter(log => !known.has(log.clientLogId as string))
			.map(log => ({ id: log.clientLogId, note: null, ...log }) as T);
		return [...serverLogs, ...pending].sort((a, b) => (a as { loggedAt: number }).loggedAt - (b as { loggedAt: number }).loggedAt);
	}

	async function loadSupplements() {
		const requestId = ++supplementsRequestId;
		const requestStartedAt = Date.now();
		try {
			const res = await fetch('/api/supplements');
			if (!res.ok) throw new Error();
			const body = await res.json() as { supplements: Supplement[] };
			const merged = await mergePendingSupplementStock(body.supplements, requestStartedAt);
			if (requestId !== supplementsRequestId) return;
			await cacheSupplements(merged, userId);
			if (requestId !== supplementsRequestId) return;
			supplements = merged;
		} catch {
			if (requestId !== supplementsRequestId) return;
			supplements = (await getOfflineSupplements()) as Supplement[];
		}
	}

	async function loadSupplementLogs() {
		const requestId = loadRequestId;
		const logs = await fetchDayLogs<Log>('/api/supplement-logs', 'create_supplement_log', (l, at, u) => cacheTodayLogs(l, at, u), getOfflineTodayLogs);
		if (requestId === loadRequestId) dayLogs = logs;
	}

	async function loadWaterLogs() {
		const requestId = loadRequestId;
		const logs = userSettings.waterTrackerEnabled ? await fetchDayLogs<WaterLog>('/api/water-logs', 'create_water_log', cacheWaterLogs, getOfflineWaterLogsToday) : [];
		if (requestId === loadRequestId) waterLogs = logs;
	}

	async function loadCaffeineLogs() {
		const requestId = loadRequestId;
		const logs = userSettings.caffeineTrackerEnabled ? await fetchDayLogs<CaffeineLog>('/api/caffeine-logs', 'create_caffeine_log', cacheCaffeineLogs, getOfflineCaffeineLogsToday) : [];
		if (requestId === loadRequestId) caffeineLogs = logs;
	}

	async function loadMeditationLogs() {
		const requestId = loadRequestId;
		const logs = userSettings.meditationTrackerEnabled ? await fetchDayLogs<MeditationLog>('/api/meditation-logs', 'create_meditation_log', cacheMeditationLogs, getOfflineMeditationLogsToday) : [];
		if (requestId === loadRequestId) meditationLogs = logs;
	}

	async function loadCaffeineDrinks() {
		try {
			const res = await fetch('/api/caffeine-drinks');
			if (!res.ok) throw new Error();
			caffeineDrinks = (await res.json()).drinks ?? [];
			cacheCaffeineDrinks(caffeineDrinks).catch(() => {});
		} catch {
			caffeineDrinks = (await getOfflineCaffeineDrinks()) as CaffeineDrink[];
		}
	}

	async function loadWaterReminders() {
		if (!userSettings.waterTrackerEnabled) return;
		try {
			const res = await fetch('/api/water-reminders');
			if (!res.ok) return;
			const today = new Date().getDay();
			waterHasReminderToday = ((await res.json()).schedules ?? []).some((s: { days: string }) => {
				try { return (JSON.parse(s.days) as number[]).includes(today); } catch { return false; }
			});
		} catch {}
	}

	async function loadMoodEntry() {
		const requestId = loadRequestId;
		if (!userSettings.moodTrackerEnabled) { moodEntry = null; return; }
		try {
			const res = await fetch(`/api/mood-logs?from=${date}&to=${date}`);
			if (!res.ok || requestId !== loadRequestId) return;
			const log = ((await res.json()).logs ?? [])[0];
			if (requestId !== loadRequestId) return;
			let activities: string[] = [];
			try { activities = log?.activities ? JSON.parse(log.activities) : []; } catch {}
			moodEntry = log ? { date: log.date, mood: log.mood, energy: log.energy ?? null, activities, note: log.note, gratitude: log.gratitude ?? null } : null;
		} catch { if (requestId === loadRequestId) moodEntry = null; }
	}

	async function loadMoodWeeklyReview() {
		if (!userSettings.moodTrackerEnabled) { previousWeekMoodLogs = []; return; }
		const now = new Date();
		const day = now.getDay() || 7;
		const thisMonday = new Date(now); thisMonday.setHours(12, 0, 0, 0); thisMonday.setDate(now.getDate() - day + 1);
		const fromDate = new Date(thisMonday); fromDate.setDate(thisMonday.getDate() - 7);
		const toDate = new Date(thisMonday); toDate.setDate(thisMonday.getDate() - 1);
		previousWeekRange = { from: toLocalDateKey(fromDate), to: toLocalDateKey(toDate) };
		try {
			const res = await fetch(`/api/mood-logs?from=${previousWeekRange.from}&to=${previousWeekRange.to}`);
			if (res.ok) previousWeekMoodLogs = (await res.json()).logs ?? [];
		} catch { previousWeekMoodLogs = []; }
	}

	async function dismissMoodWeeklyReview() {
		const week = previousWeekRange.from;
		locallyDismissedMoodWeeklyReviewWeek = week;
		try { localStorage.setItem(moodWeeklyReviewDismissKey, week); } catch {}
		userSettings.dismissedMoodWeeklyReviewWeek = week;
		await flushUserSettings();
	}

	async function loadDay() {
		++loadRequestId;
		trackerFocus = null;
		await Promise.all([loadSupplementLogs(), loadWaterLogs(), loadCaffeineLogs(), loadMeditationLogs(), loadMoodEntry()]);
		loading = false;
	}

	async function deleteLog(endpoint: string, id: string, reload: () => Promise<unknown>) {
		try {
			const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
			if (res.ok) await reload();
		} catch {}
	}

	function applySupplementLogToStock(supplementId: string, amount: number) {
		supplements = supplements.map(supplement =>
			supplement.id === supplementId && supplement.stockQuantity != null
				? { ...supplement, stockQuantity: Math.max(0, supplement.stockQuantity - amount) }
				: supplement
		);
	}

	function startMeditation(minutes: number) {
		meditationTimerDuration = minutes;
		meditationTimerOpen = true;
	}

	function openTrackerFocus(tracker: TrackerFocus) {
		waterExpanded = caffeineExpanded = meditationExpanded = moodExpanded = false;
		trackerFocus = tracker;
		void tick().then(() => containerEl?.querySelector<HTMLElement>(`#daily-${tracker}-tracker`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
	}

	// ─── Supplement tiles: tap expands, long press edits the newest log ──────────
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let pressStart = { x: 0, y: 0 };
	let suppressSupplementClick = false;

	function openEditLog(log: Log, supplement: Supplement) {
		const d = new Date(log.loggedAt);
		editLogSheet = {
			id: log.id,
			supplementName: supplement.name,
			unit: supplement.unit,
			amount: log.amount,
			time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
			date: tsToDateKey(log.loggedAt),
			note: log.note ?? null
		};
	}

	function startPress(e: PointerEvent, log: Log, supplement: Supplement) {
		suppressSupplementClick = false;
		pressStart = { x: e.clientX, y: e.clientY };
		pressTimer = setTimeout(() => {
			pressTimer = null;
			suppressSupplementClick = true;
			openEditLog(log, supplement);
		}, 500);
	}

	function cancelPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}

	function movePress(e: PointerEvent) {
		if (!pressTimer) return;
		if (Math.abs(e.clientX - pressStart.x) > 8 || Math.abs(e.clientY - pressStart.y) > 8) {
			suppressSupplementClick = true;
			cancelPress();
		}
	}

	function handleSupplementCardClick(id: string) {
		if (suppressSupplementClick) {
			suppressSupplementClick = false;
			return;
		}
		const next = new Set(expandedIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		expandedIds = next;
	}

	// Push notifications and shortcuts link to `/?action=...`; open the sheet, then drop the param.
	function handleActionParam() {
		const action = page.url.searchParams.get('action');
		if (!action) return;
		if (action === 'log-supplement') openQuickLog('supplements');
		else if (action === 'log-water') openQuickLog('tracker', 'water');
		else if (action === 'log-caffeine') openQuickLog('tracker', 'caffeine');
		else if (action === 'log-meditation') openQuickLog('tracker', 'meditation');
		else if (action === 'log-tracker') openQuickLog('tracker'); // older shortcuts and notifications
		else if (action === 'log-mood') moodEntryOpen = true;
		else if (action === 'log-meal') onaddmeal();
		const url = new URL(page.url.href);
		url.searchParams.delete('action');
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}

	$effect(() => {
		void date;
		void loadDay();
	});

	$effect(() => {
		void page.url.searchParams.get('action');
		handleActionParam();
	});

	// iOS back-swipe should close the sheet instead of leaving the page.
	$effect(() => {
		if (quickLogOpen) history.pushState(null, '', location.href);
	});

	beforeNavigate(({ type, to, cancel }) => {
		if (type === 'popstate') {
			if (editLogSheet) { editLogSheet = null; cancel(); return; }
			if (addLogSheet) { addLogSheet = null; cancel(); return; }
			if (quickLogOpen) { quickLogOpen = false; cancel(); return; }
		} else if (to && to.url.pathname !== page.url.pathname) {
			quickLogOpen = false;
			editLogSheet = null;
			addLogSheet = null;
		}
	});

	onMount(() => {
		try { locallyDismissedMoodWeeklyReviewWeek = localStorage.getItem(moodWeeklyReviewDismissKey) ?? ''; } catch {}
		const unsubscribeSupplementSync = onSupplementLogSynced(({ log, stockQuantity }) => {
			supplements = supplements.map(supplement => supplement.id === log.supplementId ? { ...supplement, stockQuantity } : supplement);
			const clientLogId = log.clientLogId;
			const withoutLocal = dayLogs.filter(entry =>
				entry.id !== log.id && (!clientLogId || (entry.id !== clientLogId && entry.clientLogId !== clientLogId))
			);
			if (log.loggedAt >= dayStart && log.loggedAt <= dayEnd) dayLogs = [...withoutLocal, log].sort((a, b) => a.loggedAt - b.loggedAt);
		});
		void Promise.all([loadSupplements(), loadCaffeineDrinks(), loadWaterReminders(), loadMoodWeeklyReview()]);

		function onVisibilityChange() {
			if (document.visibilityState === 'visible') void Promise.all([loadSupplements(), loadWaterReminders(), loadMoodWeeklyReview(), loadDay()]);
		}
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			unsubscribeSupplementSync();
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});
</script>

<section bind:this={containerEl} class="daily-log" aria-label={t.daily_log_title}>
	<div class="pb-2 flex items-center justify-between">
		<p class="text-sm font-semibold" style="color: var(--color-on-surface)">{t.daily_log_title}</p>
		<button type="button" onclick={() => openQuickLog()} class="text-xs font-semibold active:opacity-60" style="color: var(--color-primary)">+ {t.add}</button>
	</div>

	{#if loading}
		<div class="flex justify-center py-6">
			<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
		</div>
	{:else if isEmpty}
		<button type="button" onclick={() => openQuickLog()} class="daily-log-empty">{t.daily_log_empty}</button>
	{:else}
		<div class="flex flex-col gap-3">
			{#if showMoodWeeklyReview}
				<MoodWeeklyReview logs={previousWeekMoodLogs} from={previousWeekRange.from} to={previousWeekRange.to} compact={true} dismissible={true} ondismiss={dismissMoodWeeklyReview} />
			{/if}

			{#if visibleTrackers.length > 0}
				<div class="flex flex-col gap-2">
					{#each trackerRows as row, rowIndex (`tracker-row-${trackerFocus ?? 'all'}-${rowIndex}`)}
						<div class="grid grid-cols-2 gap-2 items-start">
							{#each row as tracker, columnIndex (`tracker-${rowIndex}-${columnIndex}`)}
								{#if tracker === 'caffeine'}
									<div class={trackerFocus === 'caffeine' || caffeineExpanded ? 'col-span-2' : ''}>
										<CaffeineTrackerCard anchorId="daily-caffeine-tracker" logs={caffeineLogs}
											limitMg={userSettings.caffeineLimitMg ?? 400} drinks={visibleCaffeineDrinks} logDate={date}
											onlogged={loadCaffeineLogs} ondeleted={(id) => deleteLog('/api/caffeine-logs', id, loadCaffeineLogs)}
											tileMode={true} focusMode={trackerFocus === 'caffeine'}
											onfocus={() => openTrackerFocus('caffeine')} oncollapse={() => (trackerFocus = null)}
											bind:expanded={caffeineExpanded} />
									</div>
								{:else if tracker === 'water'}
									<div class={trackerFocus === 'water' || waterExpanded ? 'col-span-2' : ''}>
										<WaterTrackerCard anchorId="daily-water-tracker" logs={waterLogs}
											goalMl={userSettings.waterGoalMl ?? 2500} logDate={date}
											onlogged={loadWaterLogs} ondeleted={(id) => deleteLog('/api/water-logs', id, loadWaterLogs)}
											tileMode={true} focusMode={trackerFocus === 'water'}
											onfocus={() => openTrackerFocus('water')} oncollapse={() => (trackerFocus = null)}
											bind:expanded={waterExpanded} />
									</div>
								{:else if tracker === 'meditation'}
									<div class={trackerFocus === 'meditation' || meditationExpanded ? 'col-span-2' : ''}>
										<MeditationTrackerCard anchorId="daily-meditation-tracker" logs={meditationLogs}
											goalMinutes={userSettings.meditationDailyGoalMinutes ?? 15} logDate={date}
											onlogged={loadMeditationLogs} ondeleted={(id) => deleteLog('/api/meditation-logs', id, loadMeditationLogs)}
											tileMode={true} focusMode={trackerFocus === 'meditation'}
											onfocus={() => openTrackerFocus('meditation')} oncollapse={() => (trackerFocus = null)}
											bind:expanded={meditationExpanded} />
									</div>
								{:else if tracker === 'mood' && moodEntry !== null}
									<div class={moodExpanded ? 'col-span-2' : ''}>
										<MoodTrackerCard todayEntry={moodEntry} todayDate={date} onreload={loadMoodEntry}
											tileMode={true} bind:expanded={moodExpanded} />
									</div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			{/if}

			{#if loggedSupplements.length > 0}
				<div class="select-none flex flex-col gap-2" aria-label={t.supplement_title}>
					{#each supplementRows as row, rowIndex (`supplement-row-${rowIndex}`)}
						<div class="grid grid-cols-3 gap-2 items-start">
						{#each row as supplement, columnIndex (`supplement-${rowIndex}-${columnIndex}`)}
							{#if supplement}
								{@const logs = logsForSupplement(supplement.id)}
								{@const total = totalAmount(supplement.id)}
								{@const expanded = expandedIds.has(supplement.id)}
								{@const logTimes = allLogTimes(supplement.id)}
								{@const latestLog = logs.reduce((a, b) => a.loggedAt > b.loggedAt ? a : b)}
								<article
									class="{expanded ? 'col-span-3' : 'aspect-square'} rounded-[20px] px-2.5 py-2.5 flex flex-col overflow-hidden"
									style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)"
								>
									<button
										type="button"
										class="flex-1 min-w-0 active:opacity-70 {expanded ? 'text-left' : 'text-center flex flex-col h-full'}"
										onpointerdown={(e) => startPress(e, latestLog, supplement)}
										onpointermove={movePress}
										onpointerup={cancelPress}
										onpointercancel={cancelPress}
										oncontextmenu={(e) => e.preventDefault()}
										onclick={() => handleSupplementCardClick(supplement.id)}
										aria-expanded={expanded}
									>
										<div class="{expanded ? 'flex items-baseline gap-1 flex-wrap' : 'flex flex-col items-center justify-center gap-0.5 flex-1 min-h-0'}">
											<p class="font-semibold text-sm leading-tight {expanded ? '' : 'line-clamp-2'}" style="color: var(--color-primary)">{supplement.name}</p>
											{#if supplement.stockQuantity != null}
												<span class="text-[10px] font-medium {expanded ? '' : 'line-clamp-1'}" style="color: {supplement.stockQuantity <= 5 ? 'var(--color-error)' : 'var(--color-on-surface-variant)'}">({supplement.stockQuantity} {t.supplement_stock_left})</span>
											{/if}
											{#if supplement.brand}
												<span class="text-[10px] {expanded ? '' : 'max-w-full truncate'}" style="color: var(--color-on-surface-variant); opacity: 0.55">{expanded ? '· ' : ''}{supplement.brand}</span>
											{/if}
										</div>
										{#if expanded}
											<p class="text-[11px] leading-tight mt-0.5 text-left" style="color: var(--color-primary)">
												{total} {displayUnit(supplement.unit, currentLang())} {isToday ? t.supplement_taken_today : ''}{logTimes ? ` ${logTimes}` : ''}
											</p>
										{:else}
											<div class="mt-auto w-full h-7 grid grid-cols-2 items-stretch rounded-[9px] overflow-hidden text-[10px] font-medium leading-none tabular-nums" style="background-color: color-mix(in srgb, var(--color-on-surface) 4%, transparent); color: var(--color-on-surface-variant)">
												<span class="min-w-0 px-1 flex items-center justify-center truncate">{total} {displayUnit(supplement.unit, currentLang())}</span>
												<span class="min-w-0 px-1 flex items-center justify-center truncate border-l" style="border-color: var(--bubble-container-border)">{logs.length > 1 ? `${logs.length}× · ` : ''}{formatTime(latestLog.loggedAt)}</span>
											</div>
										{/if}
									</button>
									{#if expanded}
										<div class="mt-2 pt-2 border-t space-y-1.5" style="border-color: var(--color-outline-variant)">
											{#each logs as log (log.id)}
												<div>
													<div class="flex items-center justify-between text-xs">
														<button
															onpointerdown={(e) => startPress(e, log, supplement)}
															onpointermove={movePress}
															onpointerup={cancelPress}
															onpointercancel={cancelPress}
															class="flex-1 text-left py-0.5 active:opacity-60"
															style="color: var(--color-primary)"
														>{log.amount} {displayUnit(supplement.unit, currentLang())} {t.supplement_log_at} {formatTime(log.loggedAt)}</button>
														<button onclick={() => openEditLog(log, supplement)} class="p-1 rounded active:opacity-50 shrink-0" aria-label={t.edit} style="color: var(--color-on-surface-variant)">
															<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
																<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
																<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
															</svg>
														</button>
														<button onclick={() => deleteLog('/api/supplement-logs', log.id, () => Promise.all([loadSupplementLogs(), loadSupplements()]))} class="p-1 rounded active:opacity-50 shrink-0" aria-label={t.supplement_log_delete} style="color: var(--color-on-surface-variant)">
															<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
																<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
															</svg>
														</button>
													</div>
													{#if log.note}
														<p class="text-[11px] px-0.5 pb-0.5 italic" style="color: var(--color-on-surface-variant)">{log.note}</p>
													{/if}
												</div>
											{/each}
											{#if supplement.nutrients.length > 0 && total > 0}
												<div class="mt-1 flex flex-wrap gap-1.5">
													{#each supplement.nutrients as n}
														<span class="text-xs px-2 py-0.5 rounded-full" style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
															{n.name}: {formatNutrientValue(n.amountPerUnit * total)} {n.unit}
														</span>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								</article>
							{/if}
						{/each}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</section>

<QuickLogSheet
	bind:open={quickLogOpen}
	supplements={activeSupplements}
	waterEnabled={userSettings.waterTrackerEnabled}
	waterGoalMl={userSettings.waterGoalMl ?? 2500}
	waterTotalMl={waterLogs.reduce((s, l) => s + l.amountMl, 0)}
	caffeineEnabled={userSettings.caffeineTrackerEnabled}
	caffeineTotalMg={caffeineLogs.reduce((s, l) => s + l.caffeineMg, 0)}
	caffeineLimitMg={userSettings.caffeineLimitMg ?? 400}
	caffeineDrinks={visibleCaffeineDrinks}
	meditationEnabled={userSettings.meditationTrackerEnabled}
	meditationTotalMinutes={Math.floor(meditationLogs.reduce((s, l) => s + l.durationSeconds, 0) / 60)}
	meditationGoalMinutes={userSettings.meditationDailyGoalMinutes ?? 15}
	moodEnabled={userSettings.moodTrackerEnabled}
	moodHasEntry={moodEntry !== null}
	moodValue={moodEntry?.mood ?? null}
	nutritionEnabled
	{nutritionTotalKcal}
	{nutritionGoalKcal}
	onaddmeal={() => { quickLogOpen = false; onaddmeal(); }}
	onstartmeditation={startMeditation}
	onrateMood={() => { quickLogOpen = false; moodEntryOpen = true; }}
	onlogged={(supplementLog) => {
		if (supplementLog) {
			applySupplementLogToStock(supplementLog.supplementId, supplementLog.amount);
			if (supplementLog.loggedAt >= dayStart && supplementLog.loggedAt <= dayEnd) {
				const withoutSameLog = dayLogs.filter(log => log.id !== supplementLog.id && log.clientLogId !== supplementLog.clientLogId);
				dayLogs = [...withoutSameLog, supplementLog].sort((a, b) => a.loggedAt - b.loggedAt);
			}
		} else {
			void Promise.all([loadWaterLogs(), loadCaffeineLogs(), loadMeditationLogs()]);
		}
	}}
	logDate={date}
	initialTab={quickLogInitialTab}
	initialTracker={quickLogInitialTracker}
/>

<MoodEntrySheet
	bind:open={moodEntryOpen}
	{date}
	initialMood={moodEntry?.mood ?? null}
	initialEnergy={moodEntry?.energy ?? null}
	initialActivities={moodEntry ? moodEntry.activities : [
		...(meditationLogs.length > 0 ? ['meditation'] : []),
		...(caffeineLogs.length > 0 ? ['caffeine'] : []),
		...(dayLogs.length > 0 ? ['supplements'] : [])
	]}
	initialNote={moodEntry?.note ?? ''}
	initialGratitude={moodEntry?.gratitude ?? ''}
	onsaved={() => { moodEntryOpen = false; void loadMoodEntry(); void loadMoodWeeklyReview(); }}
/>

<MeditationTimerSheet bind:open={meditationTimerOpen} durationMinutes={meditationTimerDuration} onsaved={loadMeditationLogs} />

<EditLogSheet
	bind:sheet={editLogSheet}
	bind:createSheet={addLogSheet}
	supplements={activeSupplements.map(s => ({ id: s.id, name: s.name, unit: s.unit, defaultAmount: s.defaultAmount }))}
	onreload={() => void Promise.all([loadSupplementLogs(), loadSupplements()])}
/>

<style>
	.daily-log { padding-bottom: 1.5rem; }
	.daily-log-empty {
		width: 100%;
		padding: 18px 12px;
		border-radius: 20px;
		border: 1px dashed var(--bubble-container-border);
		font-size: 13px;
		color: var(--color-on-surface-variant);
	}
	.daily-log-empty:active { opacity: .7; }
</style>
