// History keeps its place while the user drills into a day on the home screen and comes back
// (bottom nav or browser back). Memory only: a reload starts again at the current week.
import { todayKey } from './dates';
import type { HistoryPeriod } from './historyRange';
import type { CoverageCategory } from './historyMetrics';

export const historyView = $state<{ period: HistoryPeriod; date: string; yearCategory: 'coverage' | CoverageCategory; scrollTop: number }>({
	period: 'week',
	date: todayKey(),
	yearCategory: 'coverage',
	scrollTop: 0
});
