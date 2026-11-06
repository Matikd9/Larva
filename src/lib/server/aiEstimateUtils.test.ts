import { describe, it, expect } from 'vitest';
import {
	buildEstimateSystemInstruction,
	boundFats,
	sanitizeEstimatedItem,
	type RawAiItem
} from './aiEstimateUtils';

describe('AI Food Estimate Utils — Fats Distribution without Micros', () => {
	it('generates system instruction demanding fat distribution and banning micronutrient hallucinations', () => {
		const instruction = buildEstimateSystemInstruction();
		expect(instruction).toContain('DISTRIBUCIÓN DE GRASAS');
		expect(instruction).toContain('saturatedFat');
		expect(instruction).toContain('monounsaturatedFat');
		expect(instruction).toContain('polyunsaturatedFat');
		expect(instruction).toContain('transFat');
		expect(instruction).toContain('CERO ALUCINACIONES DE MICRONUTRIENTES');
		expect(instruction).toContain('NUNCA deduzcas ni inventes valores para micronutrientes');
	});

	describe('boundFats', () => {
		it('preserves valid fats within totalFat', () => {
			const res = boundFats(10, 3, 4, 2, 0.5);
			expect(res.saturatedFat).toBe(3);
			expect(res.monounsaturatedFat).toBe(4);
			expect(res.polyunsaturatedFat).toBe(2);
			expect(res.transFat).toBe(0.5);
		});

		it('scales down fats that exceed totalFat so sum <= totalFat', () => {
			// Sum: 5 + 5 + 4 + 1 = 15 > 10
			const res = boundFats(10, 5, 5, 4, 1);
			const sum = (res.saturatedFat ?? 0) + (res.monounsaturatedFat ?? 0) + (res.polyunsaturatedFat ?? 0) + (res.transFat ?? 0);
			expect(sum).toBeLessThanOrEqual(10.05);
			expect(res.saturatedFat).toBeLessThan(5);
		});

		it('handles zero totalFat correctly', () => {
			const res = boundFats(0, 2, 1, 0, 0);
			expect(res.saturatedFat).toBe(0);
			expect(res.monounsaturatedFat).toBe(0);
			expect(res.polyunsaturatedFat).toBe(0);
			expect(res.transFat).toBe(0);
		});

		it('returns nulls when fat fractions are omitted', () => {
			const res = boundFats(10, null, null, null, null);
			expect(res.saturatedFat).toBeNull();
			expect(res.monounsaturatedFat).toBeNull();
			expect(res.polyunsaturatedFat).toBeNull();
			expect(res.transFat).toBeNull();
		});
	});

	describe('sanitizeEstimatedItem', () => {
		it('strictly nullifies all vitamins and minerals, while keeping bounded fats', () => {
			const raw: RawAiItem = {
				displayName: 'Bistec a la plancha con puré',
				amount: 250,
				unit: 'g',
				kcal: 450,
				protein: 38,
				fat: 20,
				saturatedFat: 8,
				monounsaturatedFat: 9,
				polyunsaturatedFat: 2,
				transFat: 0.5,
				carbs: 25,
				fiber: 3,
				sugar: 2,
				sodiumMg: 350,
				// Hallucinated micros sent by raw model should be ignored/nullified
				potassiumMg: 500,
				calciumMg: 30,
				magnesiumMg: 45,
				ironMg: 3.5,
				vitaminCMg: 10,
				vitaminDIu: 5,
				vitaminB12Mcg: 2.5,
				vitaminAMcg: 15,
				vitaminB6Mg: 0.8
			};

			const item = sanitizeEstimatedItem(raw, 0);

			expect(item.displayName).toBe('Bistec a la plancha con puré');
			expect(item.amount).toBe(250);
			expect(item.kcal).toBe(450);
			expect(item.protein).toBe(38);
			expect(item.fat).toBe(20);
			expect(item.carbs).toBe(25);
			expect(item.fiber).toBe(3);
			expect(item.sugar).toBe(2);
			expect(item.sodiumMg).toBe(350);

			// Fats
			expect(item.saturatedFat).toBe(8);
			expect(item.monounsaturatedFat).toBe(9);
			expect(item.polyunsaturatedFat).toBe(2);
			expect(item.transFat).toBe(0.5);

			// Micros in item.micros
			expect(item.micros.saturatedFat).toBe(8);
			expect(item.micros.monounsaturatedFat).toBe(9);
			expect(item.micros.polyunsaturatedFat).toBe(2);
			expect(item.micros.transFat).toBe(0.5);
			expect(item.micros.sodiumMg).toBe(350);

			// All vitamins and minerals MUST BE NULL
			expect(item.micros.potassiumMg).toBeNull();
			expect(item.micros.calciumMg).toBeNull();
			expect(item.micros.magnesiumMg).toBeNull();
			expect(item.micros.ironMg).toBeNull();
			expect(item.micros.vitaminCMg).toBeNull();
			expect(item.micros.vitaminDIu).toBeNull();
			expect(item.micros.vitaminB12Mcg).toBeNull();
			expect(item.micros.vitaminAMcg).toBeNull();
			expect(item.micros.vitaminB6Mg).toBeNull();
		});
	});
});
