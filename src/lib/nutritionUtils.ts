export type NutritionActivity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type NutritionSex = 'female' | 'male';

export const NUTRITION_ACTIVITY_FACTORS: Record<NutritionActivity, number> = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	active: 1.725,
	'very-active': 1.9
};

export const NUTRITION_PROTEIN_PER_KG: Record<NutritionActivity, number> = {
	sedentary: 0.8,
	light: 1.2,
	moderate: 1.4,
	active: 1.6,
	'very-active': 1.8
};

export type NutritionGoalType = 'fat-loss' | 'maintain' | 'muscle-gain';
export type NutritionDietType = 'high-protein' | 'balanced' | 'low-carb' | 'keto';

export type NutritionTargetEstimate = {
	bmr: number;
	tdee: number;
	protein: number;
	fat: number;
	carbs: number;
	fiber: number;
};

export function calculateNutritionTargets(input: {
	sex: NutritionSex;
	age: number;
	heightCm: number;
	weightKg: number;
	activity: NutritionActivity;
	goal?: NutritionGoalType;
	diet?: NutritionDietType;
}): NutritionTargetEstimate | null {
	const { sex, age, heightCm, weightKg, activity, goal = 'maintain', diet = 'balanced' } = input;
	if (!Number.isFinite(age) || age < 10 || age > 120) return null;
	if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) return null;
	if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) return null;

	const bmrRaw = sex === 'male'
		? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
		: 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
	const tdee = Math.round(bmrRaw * NUTRITION_ACTIVITY_FACTORS[activity]);

	let targetKcal = tdee;
	if (goal === 'fat-loss') targetKcal = Math.round(tdee * 0.80);
	else if (goal === 'muscle-gain') targetKcal = Math.round(tdee * 1.10);

	let protein = 0;
	let fat = 0;
	let carbs = 0;

	if (diet === 'high-protein') {
		protein = Math.round(weightKg * 2.0);
		fat = Math.round((targetKcal * 0.25) / 9);
		carbs = Math.max(0, Math.round((targetKcal - protein * 4 - fat * 9) / 4));
	} else if (diet === 'low-carb') {
		protein = Math.round(weightKg * 1.8);
		carbs = Math.round((targetKcal * 0.20) / 4);
		fat = Math.max(0, Math.round((targetKcal - protein * 4 - carbs * 4) / 9));
	} else if (diet === 'keto') {
		protein = Math.round(weightKg * 1.6);
		carbs = Math.min(30, Math.max(15, Math.round((targetKcal * 0.05) / 4)));
		fat = Math.max(0, Math.round((targetKcal - protein * 4 - carbs * 4) / 9));
	} else {
		protein = Math.round(weightKg * 1.2);
		fat = Math.round((targetKcal * 0.30) / 9);
		carbs = Math.max(0, Math.round((targetKcal - protein * 4 - fat * 9) / 4));
	}

	return { bmr: Math.round(bmrRaw), tdee: targetKcal, protein, fat, carbs, fiber: 30 };
}

export function nextNutritionUseCount(current: number | null | undefined): number {
	return Math.max(0, Number.isFinite(current) ? current ?? 0 : 0) + 1;
}

export function parseOptionalNutritionNumber(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed.replace(',', '.'));
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function nutritionBasisSuffix(unit: 'g' | 'ml' | 'piece' | 'portion'): 'g' | 'ml' {
	return unit === 'ml' ? 'ml' : 'g';
}

export function effectiveGrams(amount: number, unit: 'g' | 'ml' | 'piece' | 'portion', gramsPerPiece: number | null | undefined): number {
	if (unit === 'piece' || unit === 'portion') return amount * (gramsPerPiece ?? 0);
	return amount;
}
