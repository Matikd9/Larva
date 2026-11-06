import { describe, it, expect } from 'vitest';
import {
	buildSystemInstruction,
	sanitizeLabelForFoodType,
	type RawNutritionLabel
} from './aiNutritionLabel';

describe('AI Nutrition Label Rules — Ultraprocessed vs Natural', () => {
	it('generates distinct system instructions for ultraprocessed vs natural', () => {
		const ultraPrompt = buildSystemInstruction('ultraprocessed');
		expect(ultraPrompt).toContain('PRODUCTO ULTRAPROCESADO');
		expect(ultraPrompt).toContain('CERO ALUCINACIONES DE MICRONUTRIENTES');
		expect(ultraPrompt).toContain('NUNCA deduzcas ni inventes valores para micronutrientes');
		expect(ultraPrompt).toContain('NUNCA supere el total de "fat"');

		const naturalPrompt = buildSystemInstruction('natural');
		expect(naturalPrompt).toContain('ALIMENTO NATURAL DE UN SOLO INGREDIENTE');
		expect(naturalPrompt).toContain('USDA FoodData Central');
		expect(naturalPrompt).toContain('Rellena las grasas faltantes');
		expect(naturalPrompt).toContain('TODOS los micronutrientes principales');
	});

	it('strips estimated micronutrients, fiber and sugar in ultraprocessed mode', () => {
		const rawLabel: RawNutritionLabel = {
			productName: 'Choco Cookies',
			brand: 'SweetBrand',
			servingQuantity: 30,
			servingUnit: 'g',
			perServing: {
				kcal: 140,
				protein: 2.0,
				fat: 6.0,
				saturatedFat: 3.0,
				monounsaturatedFat: 2.0,
				polyunsaturatedFat: 1.0,
				carbs: 20.0,
				fiber: 2.5,
				sugar: 10.0,
				sodiumMg: 80,
				calciumMg: 50,
				ironMg: 1.2,
				potassiumMg: 120
			},
			per100: {
				kcal: 467,
				protein: 6.7,
				fat: 20.0,
				saturatedFat: 10.0,
				monounsaturatedFat: 6.7,
				polyunsaturatedFat: 3.3,
				carbs: 66.7,
				fiber: 8.3,
				sugar: 33.3,
				sodiumMg: 267,
				calciumMg: 167,
				ironMg: 4.0,
				potassiumMg: 400
			},
			estimatedNutrients: [
				'monounsaturatedFat',
				'polyunsaturatedFat',
				'fiber',
				'calciumMg',
				'ironMg',
				'potassiumMg'
			]
		};

		const sanitized = sanitizeLabelForFoodType(rawLabel, 'ultraprocessed');

		// Estimated micros, fiber should be nullified
		expect(sanitized.perServing?.calciumMg).toBeNull();
		expect(sanitized.perServing?.ironMg).toBeNull();
		expect(sanitized.perServing?.potassiumMg).toBeNull();
		expect(sanitized.perServing?.fiber).toBeNull();

		expect(sanitized.per100?.calciumMg).toBeNull();
		expect(sanitized.per100?.ironMg).toBeNull();
		expect(sanitized.per100?.potassiumMg).toBeNull();
		expect(sanitized.per100?.fiber).toBeNull();

		// Non-estimated values (un-estimated sugar and sodium) should remain intact
		expect(sanitized.perServing?.sugar).toBe(10.0);
		expect(sanitized.perServing?.sodiumMg).toBe(80);

		// Estimated fats remain permitted
		expect(sanitized.perServing?.saturatedFat).toBe(3.0);
		expect(sanitized.perServing?.monounsaturatedFat).toBe(2.0);
		expect(sanitized.perServing?.polyunsaturatedFat).toBe(1.0);
		expect(sanitized.estimatedNutrients).toEqual(['monounsaturatedFat', 'polyunsaturatedFat']);
	});

	it('enforces that fat breakdown does not exceed total fat in ultraprocessed mode', () => {
		const rawLabel: RawNutritionLabel = {
			productName: 'Packaged Snack',
			perServing: {
				kcal: 100,
				fat: 5.0,
				saturatedFat: 3.0,
				monounsaturatedFat: 3.0,
				polyunsaturatedFat: 2.0,
				transFat: 0.5
			},
			estimatedNutrients: ['monounsaturatedFat', 'polyunsaturatedFat']
		};

		// 3.0 + 3.0 + 2.0 + 0.5 = 8.5g > 5.0g total fat
		const sanitized = sanitizeLabelForFoodType(rawLabel, 'ultraprocessed');

		const sum =
			(sanitized.perServing?.saturatedFat ?? 0) +
			(sanitized.perServing?.monounsaturatedFat ?? 0) +
			(sanitized.perServing?.polyunsaturatedFat ?? 0) +
			(sanitized.perServing?.transFat ?? 0);

		expect(sum).toBeLessThanOrEqual(5.05);
	});

	it('preserves all estimated micronutrients and fats in natural mode', () => {
		const naturalLabel: RawNutritionLabel = {
			productName: 'Rolled Oats 100%',
			perServing: {
				kcal: 115,
				protein: 4.0,
				fat: 2.2,
				saturatedFat: 0.4,
				monounsaturatedFat: 0.8,
				polyunsaturatedFat: 0.9,
				carbs: 18.5,
				fiber: 3.0,
				magnesiumMg: 42,
				ironMg: 1.4,
				potassiumMg: 110
			},
			estimatedNutrients: [
				'monounsaturatedFat',
				'polyunsaturatedFat',
				'fiber',
				'magnesiumMg',
				'ironMg',
				'potassiumMg'
			]
		};

		const sanitized = sanitizeLabelForFoodType(naturalLabel, 'natural');

		expect(sanitized.perServing?.magnesiumMg).toBe(42);
		expect(sanitized.perServing?.ironMg).toBe(1.4);
		expect(sanitized.perServing?.potassiumMg).toBe(110);
		expect(sanitized.perServing?.fiber).toBe(3.0);
		expect(sanitized.estimatedNutrients).toContain('magnesiumMg');
		expect(sanitized.estimatedNutrients).toContain('ironMg');
	});

	it('supports text-only estimation instructions without requiring photos', () => {
		const naturalPrompt = buildSystemInstruction('natural');
		expect(naturalPrompt).toContain('incluso cuando no se proporcionan fotografías');
		expect(naturalPrompt).toContain('Si no hay fotos, básate enteramente en el nombre del alimento');
		expect(naturalPrompt).toContain('CONSERVA esos valores');

		const ultraPrompt = buildSystemInstruction('ultraprocessed');
		expect(ultraPrompt).toContain('incluso cuando no se proporcionan fotografías');
	});
});
