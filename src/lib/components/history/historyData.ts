import type { ScheduleLite, SupplementMeta, SupplementLogLite } from '#lib/trackerStats';
import type { EssentialMicros, MicroCoverage } from '#lib/micronutrients';

export type MealDay = { date: string; meals: number; kcal: number; protein: number; fat: number; carbs: number; fiber: number };
export type NutrientTotal = { total: number; unit: string; name: string };
export type FoodMicros = { kcal: number; loggedDays: number; micros: Partial<Record<keyof EssentialMicros, MicroCoverage>> };

/** Everything History shows for one period (plus the previous one, for comparisons). */
export type HistoryData = {
	supplementLogs: (SupplementLogLite & { id: string; clientLogId?: string | null })[];
	schedules: ScheduleLite[];
	supplements: SupplementMeta[];
	supplementNutrients: Record<string, NutrientTotal>;
	water: { amountMl: number; loggedAt: number }[];
	caffeine: { caffeineMg: number; loggedAt: number }[];
	meditation: { durationSeconds: number; loggedAt: number }[];
	mealDays: MealDay[];
	mood: { date: string; mood: number }[];
	/** Month and year only: micronutrients from food for the current range. */
	foodMicros: FoodMicros | null;
};

export const emptyHistoryData = (): HistoryData => ({
	supplementLogs: [], schedules: [], supplements: [], supplementNutrients: {},
	water: [], caffeine: [], meditation: [], mealDays: [], mood: [], foodMicros: null
});

export const CATEGORY_COLORS = {
	nutrition: '#FB923C',
	water: '#60A5FA',
	caffeine: '#C8956C',
	meditation: '#A78BFA',
	mood: '#F472B6',
	supplements: 'var(--color-primary)'
} as const;
