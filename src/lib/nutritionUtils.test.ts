import { describe, expect, it } from 'vitest';
import {
	calculateNutritionTargets,
	effectiveGrams,
	nextNutritionUseCount,
	nutritionBasisSuffix,
	parseOptionalNutritionNumber
} from './nutritionUtils';

describe('calculateNutritionTargets', () => {
	it('calculates a stable Mifflin-St Jeor estimate', () => {
		expect(calculateNutritionTargets({
			sex: 'male', age: 30, heightCm: 175, weightKg: 70, activity: 'light'
		})).toEqual({ bmr: 1649, tdee: 2267, targetKcal: 2267, protein: 84, fat: 76, carbs: 312, fiber: 30 });
	});

	it('calculates fat loss with high protein diet correctly', () => {
		const res = calculateNutritionTargets({
			sex: 'male', age: 30, heightCm: 175, weightKg: 70, activity: 'light',
			goal: 'fat-loss', diet: 'high-protein'
		});
		expect(res).not.toBeNull();
		// target: 2267 * 0.8 = 1814; maintenance stays 2267
		expect(res?.targetKcal).toBe(1814);
		expect(res?.tdee).toBe(2267);
		// protein: 70 * 2.0 = 140
		expect(res?.protein).toBe(140);
	});

	it('keeps weight-based protein within the kcal target', () => {
		// 2 g/kg at 300 kg is 2400 kcal of protein alone, above this fat-loss target.
		const res = calculateNutritionTargets({
			sex: 'female', age: 120, heightCm: 100, weightKg: 300, activity: 'sedentary', goal: 'fat-loss', diet: 'high-protein'
		})!;
		expect(res.protein).toBeLessThan(600);
		expect(res.protein * 4 + res.fat * 9 + res.carbs * 4).toBeLessThanOrEqual(res.targetKcal * 1.01);
	});

	it('rejects implausible calculator inputs', () => {
		expect(calculateNutritionTargets({
			sex: 'female', age: 9, heightCm: 165, weightKg: 60, activity: 'moderate'
		})).toBeNull();
	});
});

describe('nutrition helpers', () => {
	it('increments usage instead of resetting it', () => {
		expect(nextNutritionUseCount(7)).toBe(8);
		expect(nextNutritionUseCount(null)).toBe(1);
	});

	it('keeps entered zeroes and understands decimal commas', () => {
		expect(parseOptionalNutritionNumber('0')).toBe(0);
		expect(parseOptionalNutritionNumber('3,8')).toBe(3.8);
		expect(parseOptionalNutritionNumber('')).toBeNull();
	});

	it('uses millilitres only for volume-based entries', () => {
		expect(nutritionBasisSuffix('ml')).toBe('ml');
		expect(nutritionBasisSuffix('piece')).toBe('g');
		expect(nutritionBasisSuffix('portion')).toBe('g');
	});

	it('calculates effective grams for portions correctly', () => {
		expect(effectiveGrams(2, 'portion', 7)).toBe(14);
		expect(effectiveGrams(100, 'g', null)).toBe(100);
	});
});
